import { z } from 'zod';

export const createDealSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  contact_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional(),
  stage: z.enum(['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'WON', 'LOST']).optional(),
  pipeline: z.string().default('default'),
  value: z.number().min(0).optional(),
  currency: z.string().default('IDR'),
  win_probability: z.number().min(0).max(100).optional(),
  assigned_to_id: z.string().uuid().optional(),
  expected_close_date: z.string().datetime().optional(),
  products: z.array(z.object({
    name: z.string(),
    qty: z.number().min(1),
    price: z.number().min(0),
    subtotal: z.number().min(0),
  })).optional(),
  source: z.string().optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

export const updateDealSchema = createDealSchema.partial();

export const moveDealStageSchema = z.object({
  stage: z.enum(['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'WON', 'LOST']),
});

export const closeDealWonSchema = z.object({
  won_notes: z.string().optional(),
  actual_close_date: z.string().datetime().optional(),
});

export const closeDealLostSchema = z.object({
  lost_reason: z.string().min(1),
  actual_close_date: z.string().datetime().optional(),
});

export const listDealsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  stage: z.enum(['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'WON', 'LOST']).optional(),
  closed_status: z.enum(['WON', 'LOST']).optional(),
  assigned_to: z.string().optional(),
  pipeline: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'value', 'expected_close_date']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const dealReportSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  pipeline: z.string().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type ListDealsInput = z.infer<typeof listDealsSchema>;
export type DealReportInput = z.infer<typeof dealReportSchema>;
