import { Request, Response, NextFunction } from 'express';
import { AuthService } from './service';
import { successResponse } from '../../utils/response';
import type { AuthenticatedRequest } from '../../middlewares/auth';

const deviceFrom = (req: Request) => ({
  userAgent: req.headers['user-agent'] ?? null,
  ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
});

export class AuthController {
  static async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.sendOtp(req.body);
      return successResponse(res, result.message, null);
    } catch (error) {
      return next(error);
    }
  }

  static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.verifyOtp(req.body);
      return successResponse(res, result.message, null);
    } catch (error) {
      return next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register(req.body, deviceFrom(req));
      return successResponse(res, 'User registered successfully', result, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body, deviceFrom(req));
      return successResponse(res, 'Logged in successfully', result);
    } catch (error) {
      return next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.refresh(req.body.refreshToken);
      return successResponse(res, 'Token refreshed successfully', result);
    } catch (error) {
      return next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.logout(req.body.refreshToken);
      return successResponse(res, result.message, null);
    } catch (error) {
      return next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.forgotPassword(req.body.email);
      return successResponse(res, result.message, null);
    } catch (error) {
      return next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.resetPassword(req.body.token, req.body.newPassword);
      return successResponse(res, result.message, null);
    } catch (error) {
      return next(error);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      return successResponse(res, result.message, null);
    } catch (error) {
      return next(error);
    }
  }
}
