import { Request, Response, NextFunction } from 'express';
import { aj } from '../lib/arcjet';
import { isSpoofedBot } from '@arcjet/inspect';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export const arcjetProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        errorResponse(res, 'Rate limit exceeded. Please try again later.', null, 429);
        return;
      }
      if (decision.reason.isBot()) {
        errorResponse(res, 'Bot access denied.', null, 403);
        return;
      }
      errorResponse(res, 'Access denied by security policy.', null, 403);
      return;
    }

    if (decision.results.some(isSpoofedBot)) {
      errorResponse(res, 'Malicious bot activity detected.', null, 403);
      return;
    }

    next();
  } catch (error) {
    logger.warn('Arcjet protection error (non-blocking):', error);
    next();
  }
};
