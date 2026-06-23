import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from './logger';

const LEASE_TTL = 30; // 30 seconds
const DEBOUNCE_MS = 5000; // 5 seconds flapping window

export class PresenceService {
  private static getLeaseKey(userId: string): string {
    return `presence:${userId}`;
  }

  private static getFlapKey(userId: string): string {
    return `presence:flap_timer:${userId}`;
  }

  /**
   * Sets/renews user presence status in Redis.
   * Updates database lastSeen and broadcasts presence on transition.
   */
  static async heartbeat(userId: string, io: any): Promise<void> {
    try {
      const leaseKey = this.getLeaseKey(userId);
      const flapKey = this.getFlapKey(userId);

      // Cancel any pending offline transitions
      await redis.del(flapKey);

      const isOnline = await redis.exists(leaseKey);

      // Renew lease in Redis
      await redis.set(leaseKey, 'online', 'EX', LEASE_TTL);

      if (!isOnline) {
        // Transition: Offline -> Online
        // Update database presence / lastSeen
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeen: new Date() },
        }).catch((err) => {
          logger.error(`Failed to update presence status in database for user ${userId}:`, err);
        });

        // Broadcast online status to all connected users
        io.emit('user:presence', { userId, isOnline: true });
        logger.info(`User ${userId} went online (presence lease created).`);
      }
    } catch (err) {
      logger.error(`Error in presence heartbeat for user ${userId}:`, err);
    }
  }

  /**
   * Sets a debounce key to handle connection flapping.
   * If not renewed within 15 seconds, marks user as offline in database and broadcasts status.
   */
  static async handleDisconnect(userId: string, io: any): Promise<void> {
    try {
      const leaseKey = this.getLeaseKey(userId);
      const flapKey = this.getFlapKey(userId);

      // Set a flap timer in Redis
      await redis.set(flapKey, 'pending', 'EX', DEBOUNCE_MS / 1000);

      setTimeout(async () => {
        try {
          // If the flap key still exists, the user did not reconnect / heartbeat in the window
          const isFlappingPending = await redis.exists(flapKey);
          if (isFlappingPending) {
            // Remove presence lease and timer
            await redis.del(leaseKey);
            await redis.del(flapKey);

            const lastSeen = new Date();
            // Update lastSeen in database
            await prisma.user.update({
              where: { id: userId },
              data: { lastSeen },
            }).catch((err) => {
              logger.error(`Failed to update lastSeen in DB for offline user ${userId}:`, err);
            });

            // Broadcast offline status to all connected users
            io.emit('user:presence', {
              userId,
              isOnline: false,
              lastSeen: lastSeen.toISOString(),
            });
            logger.info(`User ${userId} went offline after flapping window expired.`);
          }
        } catch (innerErr) {
          logger.error(`Error processing offline transition inside flapping timeout for user ${userId}:`, innerErr);
        }
      }, DEBOUNCE_MS);
    } catch (err) {
      logger.error(`Error in presence disconnect handler for user ${userId}:`, err);
    }
  }
}
