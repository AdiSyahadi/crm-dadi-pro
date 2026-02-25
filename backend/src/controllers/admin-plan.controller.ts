import { Request, Response, NextFunction } from 'express';
import { adminPlanService } from '../services/admin-plan.service';

export class AdminPlanController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await adminPlanService.list();
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await adminPlanService.getById(req.params.id as string);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await adminPlanService.create(req.body);
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await adminPlanService.update(req.params.id as string, req.body);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await adminPlanService.toggleActive(req.params.id as string);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }
}

export const adminPlanController = new AdminPlanController();
