import { redis } from '../config/redis';
import { prisma } from '../config/database';

export class BlockCache {
  private static getKey(userId: string): string {
    return `user:${userId}:blocklist`;
  }

  /**
   * Hydrates the user's blocklist into Redis. Call this during user login / socket connection.
   */
  static async hydrate(userId: string): Promise<void> {
    try {
      const blocks = await prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      });

      const key = this.getKey(userId);
      // Delete existing key to avoid duplicates on re-hydration
      await redis.del(key);

      if (blocks.length > 0) {
        const blockedIds = blocks.map((b) => b.blockedId);
        await redis.sadd(key, ...blockedIds);
        await redis.expire(key, 86400); // 24-hour expiration
      }
    } catch (err) {
      console.error(`Failed to hydrate blocklist for user ${userId}:`, err);
    }
  }

  /**
   * Adds a block record to both PostgreSQL and the Redis cache.
   */
  static async addBlock(blockerId: string, blockedId: string): Promise<void> {
    await prisma.block.create({
      data: { blockerId, blockedId },
    });
    
    const key = this.getKey(blockerId);
    await redis.sadd(key, blockedId);
    await redis.expire(key, 86400);
  }

  /**
   * Removes a block record from both PostgreSQL and the Redis cache.
   */
  static async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    await prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    
    await redis.srem(this.getKey(blockerId), blockedId);
  }

  /**
   * Checks if a messaging connection between two users is blocked (either direction).
   * O(1) complexity.
   */
  static async isBlocked(userA: string, userB: string): Promise<boolean> {
    try {
      // Hydrate blocker caches if they do not exist
      const keyA = this.getKey(userA);
      const keyB = this.getKey(userB);

      const [existsA, existsB] = await Promise.all([
        redis.exists(keyA),
        redis.exists(keyB),
      ]);

      if (!existsA) {
        await this.hydrate(userA);
      }
      if (!existsB) {
        await this.hydrate(userB);
      }

      const [aBlocksB, bBlocksA] = await Promise.all([
        redis.sismember(keyA, userB),
        redis.sismember(keyB, userA),
      ]);

      return !!(aBlocksB || bBlocksA);
    } catch (err) {
      console.error(`Error checking block cache between ${userA} and ${userB}, falling back to DB:`, err);
      // Fail-safe: query database directly if Redis is down
      const blockCount = await prisma.block.count({
        where: {
          OR: [
            { blockerId: userA, blockedId: userB },
            { blockerId: userB, blockedId: userA },
          ],
        },
      });
      return blockCount > 0;
    }
  }
}
