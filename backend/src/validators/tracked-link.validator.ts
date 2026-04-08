import { z } from 'zod';

export const createTrackedLinkSchema = z.object({
  deal_id: z.string().uuid(),
  original_url: z.string().url().max(2000),
  label: z.string().max(200).optional(),
  expires_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateTrackedLinkSchema = z.object({
  label: z.string().max(200).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const listTrackedLinksSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  deal_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type CreateTrackedLinkInput = z.infer<typeof createTrackedLinkSchema>;
export type UpdateTrackedLinkInput = z.infer<typeof updateTrackedLinkSchema>;
export type ListTrackedLinksInput = z.infer<typeof listTrackedLinksSchema>;
