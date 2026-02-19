import { Request, Response, NextFunction } from 'express';
import { webhookConfigService } from '../services/webhook-config.service';
import { createWebhookConfigSchema, updateWebhookConfigSchema } from '../validators/webhook-config.validator';
import { sendSuccess, sendCreated } from '../utils/api-response';

export class WebhookConfigController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await webhookConfigService.list(req.user!.organizationId);
      sendSuccess(res, configs);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await webhookConfigService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, config);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createWebhookConfigSchema.parse(req.body);
      const config = await webhookConfigService.create(req.user!.organizationId, input);
      sendCreated(res, config, 'Webhook config created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateWebhookConfigSchema.parse(req.body);
      const config = await webhookConfigService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, config, 'Webhook config updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await webhookConfigService.delete(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null, 'Webhook config deleted');
    } catch (error) {
      next(error);
    }
  }

  async test(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await webhookConfigService.testWebhook(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, result, result.success ? 'Webhook test successful' : 'Webhook test failed');
    } catch (error) {
      next(error);
    }
  }
}

export const webhookConfigController = new WebhookConfigController();
