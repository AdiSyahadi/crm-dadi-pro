import { z } from 'zod';
import crypto from 'crypto';

export const createInstanceSchema = z.object({
  name: z.string().min(1).max(100),
  phone_number: z.string().min(1).max(20).optional(),
  wa_instance_id: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
}).transform((data) => ({
  ...data,
  wa_instance_id: data.wa_instance_id || `inst_${crypto.randomBytes(8).toString('hex')}`,
}));

export const updateInstanceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  wa_instance_id: z.string().min(1).optional(),
  phone_number: z.string().min(1).max(20).optional(),
  is_default: z.boolean().optional(),
  daily_limit: z.number().min(1).max(1000).optional(),
});

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>;
