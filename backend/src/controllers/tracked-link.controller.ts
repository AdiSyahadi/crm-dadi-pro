import { Request, Response, NextFunction } from 'express';
import { trackedLinkService } from '../services/tracked-link.service';
import {
  createTrackedLinkSchema,
  updateTrackedLinkSchema,
  listTrackedLinksSchema,
} from '../validators/tracked-link.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class TrackedLinkController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listTrackedLinksSchema.parse(req.query);
      const result = await trackedLinkService.list(req.user!.organizationId, input);
      sendSuccess(res, result.links, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await trackedLinkService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, link);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTrackedLinkSchema.parse(req.body);
      const link = await trackedLinkService.create(req.user!.organizationId, req.user!.userId, input);
      sendCreated(res, link, 'Tracked link created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateTrackedLinkSchema.parse(req.body);
      const link = await trackedLinkService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, link, 'Tracked link updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await trackedLinkService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const trackedLinkController = new TrackedLinkController();
