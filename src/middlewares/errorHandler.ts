import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || null;

  if (process.env.LOG_LEVEL === 'debug') {
    logger.error(`[${statusCode}] ${message}`, err.stack ?? err);
  } else {
    logger.error(`[${statusCode}] ${message}`);
  }

  return errorResponse(res, message, errors, statusCode);
};
