import { z } from 'zod';

export const listActivityLogsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  action: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const createActivityLogSchema = z.object({
  action: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(50),
  entity_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

export type ListActivityLogsInput = z.infer<typeof listActivityLogsSchema>;
export type CreateActivityLogInput = z.infer<typeof createActivityLogSchema>;
