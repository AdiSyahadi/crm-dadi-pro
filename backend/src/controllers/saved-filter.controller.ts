import { Request, Response, NextFunction } from 'express';
import { savedFilterService } from '../services/saved-filter.service';
import { sendSuccess } from '../utils/api-response';

class SavedFilterController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = req.query.entity as string | undefined;
      const data = await savedFilterService.list(req.user!.organizationId, req.user!.userId, entity);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedFilterService.getById(req.user!.organizationId, req.user!.userId, req.params.id as string);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedFilterService.create(req.user!.organizationId, req.user!.userId, req.body);
      sendSuccess(res, data, 'Filter berhasil disimpan', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedFilterService.update(req.user!.organizationId, req.user!.userId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Filter berhasil diupdate');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await savedFilterService.delete(req.user!.organizationId, req.user!.userId, req.params.id as string);
      sendSuccess(res, null, 'Filter berhasil dihapus');
    } catch (error) {
      next(error);
    }
  }

  async setDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedFilterService.setDefault(req.user!.organizationId, req.user!.userId, req.params.id as string);
      sendSuccess(res, data, 'Filter default berhasil diset');
    } catch (error) {
      next(error);
    }
  }
}

export const savedFilterController = new SavedFilterController();
