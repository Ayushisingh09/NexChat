import { Server } from 'socket.io';
import { MessagesController } from '../modules/messages/controller';
import { logger } from './logger';
import { runWithLock } from './withLock';

const SWEEP_INTERVAL_MS = 20 * 1000; // every 20s

/**
 * Periodically fires scheduled messages whose send time has arrived, converting
 * them into normal messages and fanning them out to participants. The Redis
 * lock keeps a single instance firing each due message when clustered.
 */
export function startScheduledSweep(io: Server): NodeJS.Timeout {
  const sweep = async () => {
    await runWithLock('sweep:scheduled', 18, async () => {
      try {
        const fired = await MessagesController.runScheduledSweep(io);
        if (fired > 0) {
          logger.info(`Scheduled sweep delivered ${fired} message(s).`);
        }
      } catch (err) {
        logger.error('Scheduled sweep failed:', err);
      }
    });
  };

  setTimeout(sweep, 5000);
  return setInterval(sweep, SWEEP_INTERVAL_MS);
}
