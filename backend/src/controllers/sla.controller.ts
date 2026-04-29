import { Request, Response, NextFunction } from 'express';
import { slaService } from '../services/sla.service';
import { sendSuccess } from '../utils/api-response';

class SlaController {
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await slaService.getSettings(req.user!.organizationId);
      sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await slaService.updateSettings(req.user!.organizationId, req.body);
      sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const stats = await slaService.getStats(req.user!.organizationId, days);
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  };

  listBreached = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const data = await slaService.listBreached(req.user!.organizationId, page, limit);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };
}

export const slaController = new SlaController();
