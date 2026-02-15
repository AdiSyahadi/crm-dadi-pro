import { Request, Response, NextFunction } from 'express';
import { dealService } from '../services/deal.service';
import {
  createDealSchema,
  updateDealSchema,
  moveDealStageSchema,
  closeDealWonSchema,
  closeDealLostSchema,
  listDealsSchema,
  dealReportSchema,
} from '../validators/deal.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class DealController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listDealsSchema.parse(req.query);
      const result = await dealService.list(req.user!.organizationId, input);
      sendSuccess(res, result.deals, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async pipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pipeline = (req.query.pipeline as string) || 'default';
      const result = await dealService.pipeline(req.user!.organizationId, pipeline);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deal = await dealService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, deal);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createDealSchema.parse(req.body);
      const deal = await dealService.create(req.user!.organizationId, req.user!.userId, input);
      sendCreated(res, deal, 'Deal created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateDealSchema.parse(req.body);
      const deal = await dealService.update(req.user!.organizationId, req.user!.userId, req.params.id as string, input);
      sendSuccess(res, deal, 'Deal updated');
    } catch (error) {
      next(error);
    }
  }

  async moveStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stage } = moveDealStageSchema.parse(req.body);
      const deal = await dealService.moveStage(req.user!.organizationId, req.user!.userId, req.params.id as string, stage);
      sendSuccess(res, deal, 'Stage updated');
    } catch (error) {
      next(error);
    }
  }

  async markWon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { won_notes, actual_close_date } = closeDealWonSchema.parse(req.body);
      const deal = await dealService.markWon(req.user!.organizationId, req.user!.userId, req.params.id as string, won_notes, actual_close_date);
      sendSuccess(res, deal, 'Deal marked as WON');
    } catch (error) {
      next(error);
    }
  }

  async markLost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lost_reason, actual_close_date } = closeDealLostSchema.parse(req.body);
      const deal = await dealService.markLost(req.user!.organizationId, req.user!.userId, req.params.id as string, lost_reason, actual_close_date);
      sendSuccess(res, deal, 'Deal marked as LOST');
    } catch (error) {
      next(error);
    }
  }

  async reopen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deal = await dealService.reopen(req.user!.organizationId, req.user!.userId, req.params.id as string);
      sendSuccess(res, deal, 'Deal reopened');
    } catch (error) {
      next(error);
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { note } = req.body;
      if (!note) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Note is required' } });
        return;
      }
      const deal = await dealService.addNote(req.user!.organizationId, req.user!.userId, req.params.id as string, note);
      sendSuccess(res, deal, 'Note added');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await dealService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async closingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = dealReportSchema.parse(req.query);
      const report = await dealService.getClosingReport(req.user!.organizationId, input);
      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export const dealController = new DealController();
