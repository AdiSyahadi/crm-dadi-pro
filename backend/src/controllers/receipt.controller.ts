import { Request, Response, NextFunction } from 'express';
import { receiptService } from '../services/receipt.service';
import {
  createReceiptSchema,
  updateReceiptSchema,
  listReceiptsSchema,
  receiptConfigSchema,
} from '../validators/receipt.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class ReceiptController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listReceiptsSchema.parse(req.query);
      const result = await receiptService.list(req.user!.organizationId, input);
      sendSuccess(res, result.receipts, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await receiptService.summary(req.user!.organizationId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipt = await receiptService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, receipt);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createReceiptSchema.parse(req.body);
      const receipt = await receiptService.create(req.user!.organizationId, input);
      sendCreated(res, receipt, 'Receipt created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateReceiptSchema.parse(req.body);
      const receipt = await receiptService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, receipt, 'Receipt updated');
    } catch (error) {
      next(error);
    }
  }

  async void(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body;
      const receipt = await receiptService.void(req.user!.organizationId, req.params.id as string, reason);
      sendSuccess(res, receipt, 'Receipt voided');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await receiptService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async sendViaWA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipt = await receiptService.sendViaWA(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, receipt, 'Receipt sent via WhatsApp');
    } catch (error) {
      next(error);
    }
  }

  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await receiptService.getConfig(req.user!.organizationId);
      sendSuccess(res, config);
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = receiptConfigSchema.parse(req.body);
      const config = await receiptService.updateConfig(req.user!.organizationId, input);
      sendSuccess(res, config, 'Receipt config updated');
    } catch (error) {
      next(error);
    }
  }
}

export const receiptController = new ReceiptController();
