import { Response, NextFunction } from 'express';
import { AdminService } from './service';
import { successResponse, errorResponse } from '../../utils/response';
import type { AdminRequest } from './middleware';
import { auditLog } from './middleware';

const getClientIp = (req: import('express').Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (forwarded as string).split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export class AdminController {
  static async login(req: import('express').Request, res: Response) {
    try {
      const { password } = req.body;
      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const result = await AdminService.login(password, ip, userAgent);
      return successResponse(res, 'Admin logged in successfully', result);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Invalid credentials', null, 401);
    }
  }

  static async logout(req: AdminRequest, res: Response) {
    try {
      const ip = getClientIp(req);
      const result = await AdminService.logout(req.admin?.sessionId || '', ip);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  }

  static async logoutAll(_req: AdminRequest, res: Response) {
    try {
      const ip = getClientIp(_req);
      const result = await AdminService.logoutAll(ip);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  }

  static async getSessions(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const sessions = await AdminService.getActiveSessions();
      return successResponse(res, 'Sessions fetched', sessions);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getAuditLog(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const log = await AdminService.getAuditLog(limit);
      return successResponse(res, 'Audit log fetched', log);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getDashboard(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getDashboardStats();
      return successResponse(res, 'Dashboard stats fetched', stats);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getUsers(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const result = await AdminService.getUsers(page, limit, search);
      return successResponse(res, 'Users fetched', result);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getUserDetail(req: AdminRequest, res: Response) {
    try {
      const user = await AdminService.getUserDetail(req.params.id);
      return successResponse(res, 'User fetched', user);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  }

  static async suspendUser(req: AdminRequest, res: Response) {
    try {
      const { reason } = req.body;
      const ip = getClientIp(req);
      const result = await AdminService.suspendUser(req.params.id, reason);
      await auditLog('SUSPEND_USER', `Suspended user ${req.params.id}: ${reason}`, ip);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  }

  static async banUser(req: AdminRequest, res: Response) {
    try {
      const { reason } = req.body;
      const ip = getClientIp(req);
      const result = await AdminService.banUser(req.params.id, reason);
      await auditLog('BAN_USER', `Banned user ${req.params.id}: ${reason}`, ip);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  }

  static async deleteUser(req: AdminRequest, res: Response) {
    try {
      const ip = getClientIp(req);
      const result = await AdminService.deleteUser(req.params.id);
      await auditLog('DELETE_USER', `Deleted user ${req.params.id}`, ip);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  }

  static async getSystemHealth(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const health = await AdminService.getSystemHealth();
      return successResponse(res, 'System health fetched', health);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getDbStats(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getDbStats();
      return successResponse(res, 'Database stats fetched', stats);
    } catch (error: any) {
      return next(error);
    }
  }

  static async backupDatabase(req: AdminRequest, res: Response) {
    try {
      const { targetUrl } = req.body;
      if (!targetUrl) return errorResponse(res, 'Target PostgreSQL URL is required', null, 400);
      const ip = getClientIp(req);
      const result = await AdminService.backupDatabase(targetUrl);
      await auditLog('BACKUP_DATABASE', `Backup completed: ${result.totalRowsCopied} rows`, ip);
      return successResponse(res, result.message, result);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  }

  static async getFeatureFlags(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const flags = await AdminService.getFeatureFlags();
      return successResponse(res, 'Feature flags fetched', flags);
    } catch (error: any) {
      return next(error);
    }
  }

  static async setFeatureFlag(req: AdminRequest, res: Response) {
    try {
      const { flag, enabled } = req.body;
      const ip = getClientIp(req);
      const flags = await AdminService.setFeatureFlag(flag, enabled);
      await auditLog('FEATURE_FLAG', `${flag} = ${enabled}`, ip);
      return successResponse(res, 'Feature flag updated', flags);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  }

  static async getCommunities(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const result = await AdminService.getCommunities(page, limit, search);
      return successResponse(res, 'Communities fetched', result);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getReports(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await AdminService.getReports(page, limit);
      return successResponse(res, 'Reports fetched', result);
    } catch (error: any) {
      return next(error);
    }
  }

  static async resolveReport(req: AdminRequest, res: Response) {
    try {
      const result = await AdminService.resolveReport(req.params.id);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  }

  static async deleteReport(req: AdminRequest, res: Response) {
    try {
      const result = await AdminService.deleteReport(req.params.id);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  }

  static async getStories(req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await AdminService.getStories(page, limit);
      return successResponse(res, 'Stories fetched', result);
    } catch (error: any) {
      return next(error);
    }
  }

  static async deleteStory(req: AdminRequest, res: Response) {
    try {
      const result = await AdminService.deleteStory(req.params.id);
      return successResponse(res, result.message);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  }

  static async getMessageStats(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getMessageStats();
      return successResponse(res, 'Message stats fetched', stats);
    } catch (error: any) {
      return next(error);
    }
  }

  static async getUserGrowthStats(_req: AdminRequest, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getUserGrowthStats();
      return successResponse(res, 'User growth stats fetched', stats);
    } catch (error: any) {
      return next(error);
    }
  }
}
