import { Request, Response, NextFunction } from 'express';
import { adminOrgService } from '../services/admin-org.service';

export class AdminOrgController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminOrgService.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        plan: req.query.plan as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await adminOrgService.getById(req.params.id as string);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  async changePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await adminOrgService.changePlan(
        req.params.id as string,
        req.body.plan_code,
      );
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await adminOrgService.toggleActive(req.params.id as string);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  async setSubscriptionExpiry(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await adminOrgService.setSubscriptionExpiry(
        req.params.id as string,
        new Date(req.body.expires_at),
      );
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  async setSubscriptionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await adminOrgService.setSubscriptionStatus(
        req.params.id as string,
        req.body.status,
      );
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }
}

export const adminOrgController = new AdminOrgController();
