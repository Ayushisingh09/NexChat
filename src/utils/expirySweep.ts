import { Server } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from './logger';
import { runWithLock } from './withLock';
import { ReportService } from '../modules/reports/service';

const SWEEP_INTERVAL_MS = 60 * 1000; // every minute

/**
 * Periodically hard-deletes messages whose expiresAt has passed and notifies
 * participants so clients can drop them from view in real time.
 *
 * The work is DB-backed (`expiresAt` column), so it is inherently restart-safe:
 * a fresh boot re-queries and catches anything missed. The Redis lock only
 * ensures a single instance does the work per tick when running a cluster.
 */
export function startExpirySweep(io: Server): NodeJS.Timeout {
  const sweep = async () => {
    await runWithLock('sweep:expiry', 55, async () => {
    try {
      const now = new Date();
      const expired = await prisma.message.findMany({
        where: { expiresAt: { not: null, lte: now } },
        select: {
          id: true,
          conversationId: true,
          conversation: { select: { participants: { select: { userId: true } } } },
        },
        take: 500,
      });

      if (expired.length === 0) return;

      const ids = expired.map((m) => m.id);
      await prisma.message.deleteMany({ where: { id: { in: ids } } });

      for (const m of expired) {
        m.conversation.participants.forEach((p) => {
          io.to(`user:${p.userId}`).emit('message:expired', {
            conversationId: m.conversationId,
            messageId: m.id,
          });
        });
      }

      logger.info(`Expiry sweep removed ${expired.length} disappearing message(s).`);
    } catch (err) {
      logger.error('Expiry sweep failed:', err);
    }

    try {
      const deleted = await prisma.story.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      if (deleted.count > 0) {
        logger.info(`Expiry sweep removed ${deleted.count} expired story(ies).`);
      }
    } catch (err) {
      logger.error('Story expiry sweep failed:', err);
    }

    try {
      const deletedReports = await ReportService.deleteExpiredReports();
      if (deletedReports > 0) {
        logger.info(`Expiry sweep removed ${deletedReports} expired report(s) and associated media.`);
      }
    } catch (err) {
      logger.error('Report expiry sweep failed:', err);
    }
    });
  };

  // Run once shortly after boot, then on an interval
  setTimeout(sweep, 5000);
  return setInterval(sweep, SWEEP_INTERVAL_MS);
}
