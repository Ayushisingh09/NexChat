import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export class ReportService {
  static async createReport(
    reporterId: string,
    reportedId: string,
    reason: string,
    description?: string,
    mediaUrl?: string,
  ) {
    if (reporterId === reportedId) {
      throw new Error('Cannot report yourself');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedId,
        reason,
        description,
        mediaUrl,
        expiresAt,
      },
      include: {
        reporter: { select: { id: true, username: true, avatar: true, displayName: true } },
        reported: { select: { id: true, username: true, avatar: true, displayName: true } },
      },
    });

    logger.info(`Report created: ${report.id} (${reason}) by ${reporterId} against ${reportedId}`);
    return report;
  }

  static async deleteExpiredReports() {
    const expired = await prisma.report.findMany({
      where: { expiresAt: { lte: new Date() } },
      select: { id: true, mediaUrl: true },
    });

    if (expired.length === 0) return 0;

    for (const report of expired) {
      if (report.mediaUrl) {
        const filename = path.basename(report.mediaUrl);
        const filePath = path.join(UPLOADS_DIR, filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted report media: ${filename}`);
          }
        } catch (err) {
          logger.error(`Failed to delete report media ${filename}:`, err);
        }
      }
    }

    await prisma.report.deleteMany({
      where: { id: { in: expired.map((r) => r.id) } },
    });

    logger.info(`Expired report sweep: deleted ${expired.length} report(s) and associated media`);
    return expired.length;
  }
}
