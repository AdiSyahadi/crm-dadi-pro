import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/api-response';

export class AnalyticsController {
  async dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getDashboard(req.user!.organizationId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async messageVolume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const data = await analyticsService.getMessageVolume(req.user!.organizationId, days);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async agentPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getAgentPerformance(req.user!.organizationId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async contactGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const data = await analyticsService.getContactGrowth(req.user!.organizationId, days);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
