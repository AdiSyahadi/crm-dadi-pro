import { z } from 'zod';

// Validate cron expression (basic: 5 fields separated by spaces)
const cronRegex = /^(\S+\s+){4}\S+$/;

export const createScheduledMessageSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  instance_id: z.string().uuid(),
  message_content: z.string().min(1, 'Pesan wajib diisi'),
  media_url: z.string().min(1).optional(),
  media_type: z.enum(['image', 'video', 'audio', 'document', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  cron_expression: z.string().regex(cronRegex, 'Format cron tidak valid (contoh: 30 4 * * *)'),
  timezone: z.string().default('Asia/Jakarta'),
  skip_days: z.array(z.number().int().min(0).max(6)).optional(),
  recipient_tag_ids: z.array(z.string().uuid()).optional(),
  recipient_contact_ids: z.array(z.string().uuid()).optional(),
  delay_min_seconds: z.number().int().min(1).max(60).default(3),
  delay_max_seconds: z.number().int().min(1).max(120).default(10),
});

export const updateScheduledMessageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  instance_id: z.string().uuid().optional(),
  message_content: z.string().min(1).optional(),
  media_url: z.string().min(1).nullable().optional(),
  media_type: z.enum(['image', 'video', 'audio', 'document', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).nullable().optional(),
  cron_expression: z.string().regex(cronRegex, 'Format cron tidak valid').optional(),
  timezone: z.string().optional(),
  skip_days: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  recipient_tag_ids: z.array(z.string().uuid()).nullable().optional(),
  delay_min_seconds: z.number().int().min(1).max(60).optional(),
  delay_max_seconds: z.number().int().min(1).max(120).optional(),
});

export const addRecipientsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, 'Minimal 1 kontak'),
});

export const removeRecipientsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, 'Minimal 1 kontak'),
});

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;
export type UpdateScheduledMessageInput = z.infer<typeof updateScheduledMessageSchema>;
