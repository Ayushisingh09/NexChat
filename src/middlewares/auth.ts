import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    sid?: string; // id of the RefreshToken backing this session
  };
}

/** Cast an AuthenticatedRequest handler to a plain Express RequestHandler. */
export const authHandler = (
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown
): RequestHandler => fn as RequestHandler;

export const verifyAccessToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Access token is required', null, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      id: string;
      email?: string | null;
      phone?: string | null;
      sid?: string;
    };
    req.user = decoded;
    return next();
  } catch (error) {
    return errorResponse(res, 'Invalid or expired access token', null, 401);
  }
};
