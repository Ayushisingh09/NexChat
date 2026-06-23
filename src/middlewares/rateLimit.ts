import { Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth';

interface RateLimitOptions {
  /** Unique name for this limiter, used in the Redis key. */
  name: string;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Max requests per window. */
  max: number;
  message?: string;
}

/**
 * Redis fixed-window rate limiter keyed by user id (falls back to IP for
 * unauthenticated routes). Works across instances, unlike the in-memory
 * express-rate-limit store.
 */
export const rateLimitRedis = (options: RateLimitOptions) => {
  const { name, windowSeconds, max, message } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (env.NODE_ENV === 'development') return next();

    const identity = req.user?.id ?? req.ip ?? 'unknown';
    const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `ratelimit:${name}:${identity}:${windowId}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

      if (count > max) {
        const retryAfter = windowSeconds - Math.floor((Date.now() / 1000) % windowSeconds);
        res.setHeader('Retry-After', retryAfter);
        return errorResponse(
          res,
          message ?? 'Too many requests, please slow down.',
          { retryAfter },
          429
        );
      }

      return next();
    } catch (err) {
      // Fail open: a Redis hiccup should not take messaging down.
      logger.error(`Rate limiter "${name}" failed:`, err);
      return next();
    }
  };
};

export const messageSendLimiter = rateLimitRedis({
  name: 'msg-send',
  windowSeconds: 60,
  max: 60,
  message: 'You are sending messages too fast. Please wait a moment.',
});

export const messageActionLimiter = rateLimitRedis({
  name: 'msg-action',
  windowSeconds: 60,
  max: 120,
  message: 'Too many actions, please slow down.',
});

export const mediaLimiter = rateLimitRedis({
  name: 'media',
  windowSeconds: 60,
  max: 40,
  message: 'Too many uploads, please wait a moment.',
});

export const authLimiter = rateLimitRedis({
  name: 'auth',
  windowSeconds: 15 * 60,
  max: 20,
  message: 'Too many attempts. Please try again later.',
});

// AI image generation is expensive and upstream-rate-limited; keep it tight.
export const aiImageLimiter = rateLimitRedis({
  name: 'ai-image',
  windowSeconds: 60,
  max: 8,
  message: 'You are generating images too quickly. Please wait a moment.',
});
