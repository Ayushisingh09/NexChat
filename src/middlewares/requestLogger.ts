import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Lightweight structured request logger built on the project's custom logger.
 * Logs one line per completed request: method, path, status, duration, and a
 * short request id (also attached to the response as `X-Request-Id` so a log
 * line can be correlated with a client error). Health probes are skipped to
 * keep the output quiet under load-balancer polling.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/health')) return next();

  const requestId = crypto.randomBytes(6).toString('hex');
  res.setHeader('X-Request-Id', requestId);

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms [${requestId}]`;
    // 5xx is an error, 4xx a warning, everything else info.
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });

  next();
};
