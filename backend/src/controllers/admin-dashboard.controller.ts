import { Request, Response, NextFunction } from 'express';
import { adminStatsService } from '../services/admin-stats.service';

export class AdminDashboardController {
  async getDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminStatsService.getDashboard();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const adminDashboardController = new AdminDashboardController();
