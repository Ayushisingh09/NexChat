import { Response } from 'express';
import { ReportService } from './service';
import { successResponse, errorResponse } from '../../utils/response';
import type { AuthenticatedRequest } from '../../middlewares/auth';

export class ReportController {
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { reportedId, reason, description, mediaUrl } = req.body;
      if (!reportedId || !reason) {
        return errorResponse(res, 'reportedId and reason are required');
      }
      const validReasons = ['SPAM', 'ABUSE', 'HARASSMENT', 'OTHER'];
      if (!validReasons.includes(reason)) {
        return errorResponse(res, 'Invalid reason. Must be one of: ' + validReasons.join(', '));
      }
      const report = await ReportService.createReport(req.user!.id, reportedId, reason, description, mediaUrl);
      return successResponse(res, 'Report submitted successfully', report, 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to submit report', null, 400);
    }
  }
}
