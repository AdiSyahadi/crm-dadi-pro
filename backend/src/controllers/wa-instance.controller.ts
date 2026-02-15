import { Request, Response, NextFunction } from 'express';
import { waInstanceService } from '../services/wa-instance.service';
import { syncService } from '../services/sync.service';
import { createInstanceSchema, updateInstanceSchema } from '../validators/wa-instance.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class WAInstanceController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instances = await waInstanceService.list(req.user!.organizationId);
      sendSuccess(res, instances);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instance = await waInstanceService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, instance);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createInstanceSchema.parse(req.body);
      const instance = await waInstanceService.create(req.user!.organizationId, input);
      sendCreated(res, instance, 'Instance registered');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateInstanceSchema.parse(req.body);
      const instance = await waInstanceService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, instance, 'Instance updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await waInstanceService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await waInstanceService.getStatus(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  }

  async getQR(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const qr = await waInstanceService.getQR(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, qr);
    } catch (error) {
      next(error);
    }
  }

  async fetchRemote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const remoteInstances = await waInstanceService.fetchRemoteInstances(req.user!.organizationId);
      sendSuccess(res, remoteInstances);
    } catch (error) {
      next(error);
    }
  }

  async syncMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await syncService.syncFromWaApi(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, result, `Sync selesai: ${result.conversations} percakapan, ${result.messages} pesan, ${result.contacts} kontak baru`);
    } catch (error) {
      next(error);
    }
  }
}

export const waInstanceController = new WAInstanceController();
