import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { errorResponse } from '../../utils/response';
import { logger } from '../../utils/logger';

export interface AdminRequest extends Request {
  admin?: {
    role: string;
    sessionId: string;
  };
}

// --- IP Whitelist ---
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (forwarded as string).split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const adminIpWhitelist = (req: Request, res: Response, next: NextFunction) => {
  if (!env.ADMIN_ALLOWED_IPS) return next();

  const allowed = env.ADMIN_ALLOWED_IPS.split(',').map(ip => ip.trim()).filter(Boolean);
  if (allowed.length === 0) return next();

  const clientIp = getClientIp(req);
  if (!allowed.includes(clientIp)) {
    logger.warn(`Admin IP blocked: ${clientIp}`);
    return errorResponse(res, 'Access denied from this IP', null, 403);
  }
  next();
};

// --- Login Rate Limiter (Redis-based) ---
export const checkLoginAttempts = async (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const key = `admin:login_attempts:${ip}`;

  try {
    const attempts = parseInt((await redis.get(key)) || '0');
    if (attempts >= env.ADMIN_MAX_LOGIN_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      logger.warn(`Admin login locked out: ${ip} (attempts: ${attempts}, ttl: ${ttl}s)`);
      return errorResponse(res, `Too many attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`, null, 429);
    }
  } catch { /* fail open */ }
  return next();
};

export const recordFailedLogin = async (ip: string) => {
  const key = `admin:login_attempts:${ip}`;
  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, Math.ceil(env.ADMIN_LOCKOUT_MS / 1000));
    }
  } catch { /* ignore */ }
};

export const clearLoginAttempts = async (ip: string) => {
  try {
    await redis.del(`admin:login_attempts:${ip}`);
  } catch { /* ignore */ }
};

// --- Audit Logger ---
export const auditLog = async (action: string, details: string, ip?: string) => {
  const entry = {
    action,
    details,
    ip: ip || 'unknown',
    timestamp: new Date().toISOString(),
  };
  try {
    await redis.lpush('admin:audit_log', JSON.stringify(entry));
    await redis.ltrim('admin:audit_log', 0, 999); // keep last 1000
  } catch { /* ignore */ }
  logger.info(`[ADMIN AUDIT] ${action}: ${details} (IP: ${ip})`);
};

export const getAuditLog = async (limit = 50) => {
  try {
    const entries = await redis.lrange('admin:audit_log', 0, limit - 1);
    return entries.map(e => JSON.parse(e));
  } catch {
    return [];
  }
};

// --- Session Management ---
export const createAdminSession = async (ip: string, userAgent?: string) => {
  const sessionId = `admin:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const sessionData = { ip, userAgent: userAgent || 'unknown', createdAt: new Date().toISOString() };

  try {
    await redis.set(`admin:session:${sessionId}`, JSON.stringify(sessionData), 'EX', Math.ceil(env.ADMIN_SESSION_TIMEOUT_MS / 1000));
    // Track active sessions
    await redis.sadd('admin:active_sessions', sessionId);
  } catch { /* ignore */ }

  return sessionId;
};

export const validateAdminSession = async (sessionId: string): Promise<boolean> => {
  try {
    const exists = await redis.exists(`admin:session:${sessionId}`);
    return exists === 1;
  } catch {
    return false;
  }
};

export const destroyAdminSession = async (sessionId: string) => {
  try {
    await redis.del(`admin:session:${sessionId}`);
    await redis.srem('admin:active_sessions', sessionId);
  } catch { /* ignore */ }
};

export const getActiveSessions = async () => {
  try {
    const sessionIds = await redis.smembers('admin:active_sessions');
    const sessions = [];
    for (const id of sessionIds) {
      const data = await redis.get(`admin:session:${id}`);
      if (data) {
        sessions.push({ id, ...JSON.parse(data) });
      } else {
        await redis.srem('admin:active_sessions', id);
      }
    }
    return sessions;
  } catch {
    return [];
  }
};

export const destroyAllSessions = async () => {
  try {
    const sessionIds = await redis.smembers('admin:active_sessions');
    for (const id of sessionIds) {
      await redis.del(`admin:session:${id}`);
    }
    await redis.del('admin:active_sessions');
  } catch { /* ignore */ }
};

// --- Admin Token Verification ---
export const verifyAdminToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Admin token required', null, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET) as {
      role: string;
      sessionId: string;
      iat: number;
    };

    if (decoded.role !== 'admin') {
      return errorResponse(res, 'Admin access required', null, 403);
    }

    // Validate session is still active
    if (decoded.sessionId) {
      const validSession = await validateAdminSession(decoded.sessionId);
      if (!validSession) {
        return errorResponse(res, 'Session expired. Please login again.', null, 401);
      }
    }

    (req as AdminRequest).admin = { role: decoded.role, sessionId: decoded.sessionId || '' };
    return next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired. Please login again.', null, 401);
    }
    return errorResponse(res, 'Invalid admin token', null, 401);
  }
};

// --- Request Logger for Admin ---
export const adminRequestLogger = (req: Request, _res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  logger.info(`[ADMIN] ${req.method} ${req.path} from ${ip}`);
  next();
};

export const adminHandler = (
  fn: (req: AdminRequest, res: Response, next: NextFunction) => unknown
) => fn as import('express').RequestHandler;
