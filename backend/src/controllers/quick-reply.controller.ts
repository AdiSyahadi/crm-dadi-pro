import { Request, Response, NextFunction } from 'express';
import { quickReplyService } from '../services/quick-reply.service';
import { sendSuccess } from '../utils/api-response';

class QuickReplyController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const data = await quickReplyService.list(req.user!.organizationId, search);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await quickReplyService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await quickReplyService.create(req.user!.organizationId, req.body);
      sendSuccess(res, data, 'Quick reply berhasil dibuat', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await quickReplyService.update(req.user!.organizationId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Quick reply berhasil diupdate');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await quickReplyService.delete(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null, 'Quick reply berhasil dihapus');
    } catch (error) {
      next(error);
    }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query.q as string || '';
      const data = await quickReplyService.search(req.user!.organizationId, q);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async incrementUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await quickReplyService.incrementUsage(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null);
    } catch (error) {
      next(error);
    }
  }
}

export const quickReplyController = new QuickReplyController();
