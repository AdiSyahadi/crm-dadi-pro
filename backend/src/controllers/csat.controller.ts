import { Request, Response, NextFunction } from 'express';
import { csatService } from '../services/csat.service';
import { sendSuccess } from '../utils/api-response';

class CSATController {
  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await csatService.getSettings(req.user!.organizationId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await csatService.updateSettings(req.user!.organizationId, req.body);
      sendSuccess(res, data, 'CSAT settings diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async recordResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await csatService.recordResponse(req.user!.organizationId, req.body);
      sendSuccess(res, data, 'CSAT response recorded', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { start_date, end_date } = req.query;
      const data = await csatService.getAnalytics(
        req.user!.organizationId,
        start_date as string | undefined,
        end_date as string | undefined
      );
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await csatService.listResponses(req.user!.organizationId, page, limit);
      sendSuccess(res, data.responses, undefined, 200, data.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const csatController = new CSATController();
