import { Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';
import { getTier } from '../config/cipherTiers';

const WINDOW_SECONDS = 86400;

export const cipherDailyLimit = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (env.NODE_ENV === 'development') return next();

    const userId = req.user?.id;
    if (!userId) return next();

    const today = new Date().toISOString().slice(0, 10);
    const key = `cipher:usage:${userId}:${today}`;
    const tierIndex = (req as any).userTierIndex ?? 0;
    const tier = getTier(tierIndex);
    const limit = tier.dailyTokenLimit;

    try {
      if (limit === Infinity) {
        (req as any).cipherUsageKey = key;
        (req as any).cipherCurrentUsage = 0;
        return next();
      }

      const currentUsageStr = await redis.get(key);
      const currentUsage = parseInt(currentUsageStr || '0', 10);

      if (currentUsage >= limit) {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        return errorResponse(
          res,
          'Daily limit reached',
          {
            limit,
            used: currentUsage,
            resetsAt: tomorrow.toISOString(),
            tier: tier.name,
          },
          429
        );
      }

      (req as any).cipherUsageKey = key;
      (req as any).cipherCurrentUsage = currentUsage;
      (req as any).cipherTier = tier;

      return next();
    } catch (err) {
      logger.warn('Cipher rate limiter failed, allowing request:', err);
      return next();
    }
  };
};

export async function incrementCipherUsage(req: AuthenticatedRequest, tokensUsed: number): Promise<void> {
  const key = (req as any).cipherUsageKey;
  if (!key) return;
  const tier = (req as any).cipherTier;
  if (tier && tier.dailyTokenLimit === Infinity) return;

  try {
    await redis.incrby(key, tokensUsed);
    await redis.expire(key, WINDOW_SECONDS);
  } catch (err) {
    logger.warn('Failed to increment cipher Redis usage:', err);
  }
}
