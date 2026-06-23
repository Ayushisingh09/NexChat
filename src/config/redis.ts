import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const createRedisClient = () => {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
};

export const redis = createRedisClient();

redis.on('connect', () => {
  logger.info('Redis connected successfully.');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});
