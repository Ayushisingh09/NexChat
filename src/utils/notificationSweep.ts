import { NotificationQueueService } from '../services/notificationQueue';
import { logger } from './logger';
import { runWithLock } from './withLock';

const SWEEP_INTERVAL_MS = 10 * 1000;

export function startNotificationSweep(): NodeJS.Timeout {
  const sweep = async () => {
    await runWithLock('sweep:notification_queue', 8, async () => {
      try {
        const sent = await NotificationQueueService.processQueue();
        if (sent > 0) {
          logger.info(`Notification queue delivered ${sent} push(es).`);
        }
      } catch (err) {
        logger.error('Notification queue sweep failed:', err);
      }
    });
  };

  setTimeout(sweep, 3000);
  return setInterval(sweep, SWEEP_INTERVAL_MS);
}
