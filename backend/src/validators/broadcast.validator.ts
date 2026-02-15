import { z } from 'zod';

export const createBroadcastSchema = z.object({
  name: z.string().min(1).max(200),
  instance_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
  message_content: z.string().min(1),
  media_url: z.string().url().optional(),
  media_type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  scheduled_at: z.string().datetime().optional(),
  delay_min_seconds: z.number().min(3).max(60).default(5),
  delay_max_seconds: z.number().min(5).max(120).default(15),
  recipient_contact_ids: z.array(z.string().uuid()).min(1),
});

export const listBroadcastsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
});

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
export type ListBroadcastsInput = z.infer<typeof listBroadcastsSchema>;
