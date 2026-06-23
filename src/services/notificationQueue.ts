import { prisma } from '../config/database';
import { firebaseAdmin } from '../config/firebase';
import { logger } from '../utils/logger';

export class NotificationQueueService {
  static async enqueue(opts: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    maxRetries?: number;
  }) {
    try {
      await prisma.notificationQueue.create({
        data: {
          userId: opts.userId,
          type: opts.type,
          title: opts.title,
          body: opts.body,
          data: opts.data ?? {},
          maxRetries: opts.maxRetries ?? 3,
        },
      });
    } catch (err) {
      logger.error('Failed to enqueue notification:', err);
    }
  }

  static async processQueue(): Promise<number> {
    if (!firebaseAdmin) return 0;

    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(firebaseAdmin);

    const entries = await prisma.notificationQueue.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (entries.length === 0) return 0;

    const userIds = [...new Set(entries.map((e) => e.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fcmToken: true },
    });
    const tokenMap = new Map(users.map((u) => [u.id, u.fcmToken]));

    let sent = 0;
    for (const entry of entries) {
      if (entry.retryCount >= entry.maxRetries) {
        await prisma.notificationQueue.update({
          where: { id: entry.id },
          data: { status: 'FAILED', lastError: 'Max retries exceeded' },
        });
        continue;
      }

      const token = tokenMap.get(entry.userId);
      if (!token) {
        await prisma.notificationQueue.update({
          where: { id: entry.id },
          data: { status: 'FAILED', lastError: 'No FCM token', retryCount: { increment: 1 } },
        });
        continue;
      }

      try {
        await messaging.send({
          token,
          notification: {
            title: entry.title,
            body: entry.body,
          },
          data: {
            type: entry.type,
            ...(entry.data as Record<string, string> || {}),
          },
        });
        await prisma.notificationQueue.update({
          where: { id: entry.id },
          data: { status: 'SENT' },
        });
        sent++;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await prisma.user
            .update({ where: { id: entry.userId }, data: { fcmToken: null } })
            .catch(() => {});
          await prisma.notificationQueue.update({
            where: { id: entry.id },
            data: { status: 'FAILED', lastError: 'Token invalid', retryCount: { increment: 1 } },
          });
        } else {
          await prisma.notificationQueue.update({
            where: { id: entry.id },
            data: { lastError: (err as Error)?.message || 'Unknown', retryCount: { increment: 1 } },
          });
          logger.error(`Queue notification send failed for entry ${entry.id}:`, err);
        }
      }
    }

    return sent;
  }
}
