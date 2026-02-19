import { z } from 'zod';

export const WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'message.delivered',
  'message.read',
  'contact.created',
  'contact.updated',
  'deal.created',
  'deal.updated',
  'deal.stage_changed',
  'deal.won',
  'deal.lost',
  'conversation.assigned',
  'conversation.resolved',
  'conversation.reopened',
] as const;

export const createWebhookConfigSchema = z.object({
  name: z.string().min(1).max(100),
  webhook_url: z.string().url(),
  webhook_secret: z.string().max(255).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  wa_instance_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

export const updateWebhookConfigSchema = createWebhookConfigSchema.partial();

export type CreateWebhookConfigInput = z.infer<typeof createWebhookConfigSchema>;
export type UpdateWebhookConfigInput = z.infer<typeof updateWebhookConfigSchema>;
