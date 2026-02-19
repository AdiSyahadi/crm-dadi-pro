import { Request, Response, NextFunction } from 'express';
import { autoResponseService } from '../services/auto-response.service';
import { sendSuccess, sendNoContent } from '../utils/api-response';
import { z } from 'zod';

const upsertSchema = z.object({
  trigger: z.enum(['NEW_CHAT', 'OUTSIDE_HOURS']),
  template_id: z.string().uuid(),
  business_hour_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  business_hour_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  business_days: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  timezone: z.string().optional(),
  cooldown_minutes: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const deleteSchema = z.object({
  trigger: z.enum(['NEW_CHAT', 'OUTSIDE_HOURS']),
});

export class AutoResponseController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rules = await autoResponseService.list(req.user!.organizationId);
      sendSuccess(res, rules);
    } catch (error) {
      next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = upsertSchema.parse(req.body);
      const rule = await autoResponseService.upsert(req.user!.organizationId, input);
      sendSuccess(res, rule, 'Auto-response saved');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trigger } = deleteSchema.parse(req.params);
      await autoResponseService.delete(req.user!.organizationId, trigger);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const autoResponseController = new AutoResponseController();
