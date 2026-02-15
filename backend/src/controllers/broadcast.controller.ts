import { Request, Response, NextFunction } from 'express';
import { broadcastService } from '../services/broadcast.service';
import { createBroadcastSchema, listBroadcastsSchema } from '../validators/broadcast.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class BroadcastController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listBroadcastsSchema.parse(req.query);
      const result = await broadcastService.list(req.user!.organizationId, input);
      sendSuccess(res, result.broadcasts, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const broadcast = await broadcastService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, broadcast);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createBroadcastSchema.parse(req.body);
      const broadcast = await broadcastService.create(req.user!.organizationId, req.user!.userId, input);
      sendCreated(res, broadcast, 'Broadcast created');
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const broadcast = await broadcastService.start(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, broadcast, 'Broadcast started');
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const broadcast = await broadcastService.pause(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, broadcast, 'Broadcast paused');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const broadcast = await broadcastService.cancel(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, broadcast, 'Broadcast cancelled');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await broadcastService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const broadcastController = new BroadcastController();
