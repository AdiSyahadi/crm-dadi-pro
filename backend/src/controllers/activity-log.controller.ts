import { Request, Response, NextFunction } from 'express';
import { activityLogService } from '../services/activity-log.service';
import { listActivityLogsSchema } from '../validators/activity-log.validator';
import { sendSuccess } from '../utils/api-response';

export class ActivityLogController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listActivityLogsSchema.parse(req.query);
      const result = await activityLogService.list(req.user!.organizationId, input);
      sendSuccess(res, result.logs, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const activityLogController = new ActivityLogController();
