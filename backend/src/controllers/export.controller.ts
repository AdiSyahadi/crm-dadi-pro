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

  async exportTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportTasks(req.user!.organizationId, { status, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportReceipts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportReceipts(req.user!.organizationId, { status, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=receipts.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportBroadcasts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportBroadcasts(req.user!.organizationId, { status, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=broadcasts.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csv = await exportService.exportTemplates(req.user!.organizationId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=templates.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entity_type, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportActivityLogs(req.user!.organizationId, { entity_type, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportScheduledMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csv = await exportService.exportScheduledMessages(req.user!.organizationId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=scheduled-messages.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, from, to } = req.query as Record<string, string>;
      const csv = await exportService.exportAppointments(req.user!.organizationId, { status, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=appointments.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const exportController = new ExportController();
