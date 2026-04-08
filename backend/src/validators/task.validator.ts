import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['FOLLOW_UP', 'CALL', 'MEETING', 'EMAIL', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  due_date: z.string().datetime().optional(),
  reminder_at: z.string().datetime().optional(),
  assigned_to_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['FOLLOW_UP', 'CALL', 'MEETING', 'EMAIL', 'OTHER']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  due_date: z.string().datetime().nullable().optional(),
  reminder_at: z.string().datetime().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  deal_id: z.string().uuid().nullable().optional(),
  conversation_id: z.string().uuid().nullable().optional(),
});

export const listTasksSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  type: z.enum(['FOLLOW_UP', 'CALL', 'MEETING', 'EMAIL', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigned_to: z.string().optional(),
  contact_id: z.string().optional(),
  deal_id: z.string().optional(),
  search: z.string().optional(),
  due_from: z.string().optional(),
  due_to: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'due_date', 'priority']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksInput = z.infer<typeof listTasksSchema>;
