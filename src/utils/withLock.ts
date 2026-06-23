import crypto from 'crypto';
import { redis } from '../config/redis';
import { logger } from './logger';

// Stable per-process identity so a lock holder can verify ownership on release.
const INSTANCE_ID = crypto.randomBytes(8).toString('hex');

/**
 * Run `fn` only if this process can acquire the named Redis lock. Used to make
 * the periodic sweeps safe to run on multiple instances: only one instance does
 * the work per tick, the rest skip. The lock auto-expires after `ttlSeconds` so
 * a crashed holder never blocks future ticks. Released on completion only if we
 * still own it (guards against releasing a lock that expired and was re-taken).
 *
 * Returns true if the lock was acquired and `fn` ran, false if skipped.
 */
export async function runWithLock(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<void>
): Promise<boolean> {
  const lockKey = `lock:${key}`;
  let acquired = false;
  try {
    const res = await redis.set(lockKey, INSTANCE_ID, 'EX', ttlSeconds, 'NX');
    acquired = res === 'OK';
  } catch (err) {
    // Fail open: if Redis is briefly unavailable, run anyway rather than
    // silently stop sweeping. Duplicate work is preferable to no work.
    logger.error(`Lock acquisition for "${key}" failed; running unguarded:`, err);
    await fn();
    return true;
  }

  if (!acquired) return false;

  try {
    await fn();
    return true;
  } finally {
    try {
      const owner = await redis.get(lockKey);
      if (owner === INSTANCE_ID) await redis.del(lockKey);
    } catch {
      /* lock will expire on its own */
    }
  }
}
