import { Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';

const LIMITS: Record<string, number> = {
  avatar: 5,
  story: 10,
  imagine: 10,
};

const WINDOW_SECONDS = 3600;

export const aiRateLimiter = (type: string) => {
  const max = LIMITS[type] || 20;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (env.NODE_ENV === 'development') return next();

    const userId = req.user?.id;
    if (!userId) return next();

    const key = `ai_ratelimit:${type}:${userId}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }

      if (count > max) {
        const ttl = await redis.ttl(key);
        return errorResponse(
          res,
          'Rate limit exceeded',
          { retryAfter: Math.max(1, ttl) },
          429
        );
      }

      return next();
    } catch (err) {
      logger.warn(`AI rate limiter "${type}" failed, allowing request:`, err);
      return next();
    }
  };
};
