import { Request, Response, NextFunction } from 'express';
import { scheduledMessageService } from '../services/scheduled-message.service';
import {
  createScheduledMessageSchema,
  updateScheduledMessageSchema,
  addRecipientsSchema,
  removeRecipientsSchema,
} from '../validators/scheduled-message.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class ScheduledMessageController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedules = await scheduledMessageService.list(req.user!.organizationId);
      sendSuccess(res, schedules);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = await scheduledMessageService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, schedule);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createScheduledMessageSchema.parse(req.body);
      const schedule = await scheduledMessageService.create(req.user!.organizationId, req.user!.userId, input);
      sendCreated(res, schedule, 'Jadwal pesan berhasil dibuat');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateScheduledMessageSchema.parse(req.body);
      const schedule = await scheduledMessageService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, schedule, 'Jadwal pesan berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = await scheduledMessageService.toggle(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, schedule, schedule.is_active ? 'Jadwal diaktifkan' : 'Jadwal dinonaktifkan');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await scheduledMessageService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async addRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contact_ids } = addRecipientsSchema.parse(req.body);
      const schedule = await scheduledMessageService.addRecipients(req.user!.organizationId, req.params.id as string, contact_ids);
      sendSuccess(res, schedule, 'Penerima berhasil ditambahkan');
    } catch (error) {
      next(error);
    }
  }

  async removeRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contact_ids } = removeRecipientsSchema.parse(req.body);
      const schedule = await scheduledMessageService.removeRecipients(req.user!.organizationId, req.params.id as string, contact_ids);
      sendSuccess(res, schedule, 'Penerima berhasil dihapus');
    } catch (error) {
      next(error);
    }
  }

  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await scheduledMessageService.getLogs(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, logs);
    } catch (error) {
      next(error);
    }
  }
}

export const scheduledMessageController = new ScheduledMessageController();
