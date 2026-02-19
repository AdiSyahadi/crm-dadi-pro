import { Request, Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';
import { createTemplateSchema, updateTemplateSchema, listTemplatesSchema } from '../validators/template.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class TemplateController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listTemplatesSchema.parse(req.query);
      const result = await templateService.list(req.user!.organizationId, input);
      sendSuccess(res, result.templates, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templateService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTemplateSchema.parse(req.body);
      const template = await templateService.create(req.user!.organizationId, req.user!.userId, input);
      sendCreated(res, template, 'Template created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateTemplateSchema.parse(req.body);
      const template = await templateService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, template, 'Template updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await templateService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templateService.toggleActive(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, template, 'Template status toggled');
    } catch (error) {
      next(error);
    }
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templateService.incrementUsage(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, template, 'Template usage recorded');
    } catch (error) {
      next(error);
    }
  }
}

export const templateController = new TemplateController();
