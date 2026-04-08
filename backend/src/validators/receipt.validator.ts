import { z } from 'zod';

const receiptItemSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().min(1),
  price: z.number().min(0),
  subtotal: z.number().min(0),
});

export const createReceiptSchema = z.object({
  deal_id: z.string().uuid().optional(),
  type: z.enum(['invoice', 'donation', 'zakat', 'service', 'custom']).default('invoice'),
  recipient_name: z.string().min(1).max(200),
  recipient_phone: z.string().max(20).optional(),
  recipient_email: z.string().email().optional(),
  items: z.array(receiptItemSchema).min(1),
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  currency: z.string().default('IDR'),
  payment_method: z.string().max(100).optional(),
  payment_ref: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  footer_text: z.string().max(500).optional(),
});

export const updateReceiptSchema = createReceiptSchema.partial();

export const listReceiptsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SENT', 'FAILED', 'VOIDED']).optional(),
  type: z.enum(['invoice', 'donation', 'zakat', 'service', 'custom']).optional(),
  deal_id: z.string().uuid().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'total_amount', 'receipt_number']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const receiptConfigSchema = z.object({
  org_name: z.string().max(200).optional(),
  org_address: z.string().max(500).optional(),
  org_phone: z.string().max(20).optional(),
  org_email: z.string().email().optional(),
  logo_url: z.string().url().optional(),
  primary_color: z.string().max(10).optional(),
  footer_text: z.string().max(500).optional(),
  signature_name: z.string().max(100).optional(),
  signature_title: z.string().max(100).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
export type ListReceiptsInput = z.infer<typeof listReceiptsSchema>;
export type ReceiptConfigInput = z.infer<typeof receiptConfigSchema>;
