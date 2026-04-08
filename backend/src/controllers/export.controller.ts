import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service';

class ExportController {
  async exportConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportConversations(req.user!.organizationId, { status, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=conversations.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportContacts(req.user!.organizationId, { from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportDeals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stage, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportDeals(req.user!.organizationId, { stage, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=deals.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const exportController = new ExportController();
