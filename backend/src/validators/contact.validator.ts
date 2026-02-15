import { z } from 'zod';

export const createContactSchema = z.object({
  phone_number: z.string().min(10).max(20),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  company: z.string().max(100).optional(),
  job_title: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  notes: z.string().optional(),
  source: z.enum(['WHATSAPP', 'MANUAL', 'IMPORT', 'API', 'WEBSITE']).optional(),
  stage: z.enum(['NEW', 'LEAD', 'QUALIFIED', 'CUSTOMER', 'VIP', 'CHURNED']).optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const listContactsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  stage: z.enum(['NEW', 'LEAD', 'QUALIFIED', 'CUSTOMER', 'VIP', 'CHURNED']).optional(),
  source: z.enum(['WHATSAPP', 'MANUAL', 'IMPORT', 'API', 'WEBSITE']).optional(),
  tag: z.string().optional(),
  sort_by: z.enum(['name', 'phone_number', 'created_at', 'last_message_at', 'total_messages']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const importContactsSchema = z.object({
  contacts: z.array(
    z.object({
      phone_number: z.string().min(10).max(20),
      name: z.string().max(100).optional(),
      email: z.string().email().optional(),
      company: z.string().max(100).optional(),
      tags: z.array(z.string()).optional(),
    })
  ).min(1).max(1000),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsInput = z.infer<typeof listContactsSchema>;
export type ImportContactsInput = z.infer<typeof importContactsSchema>;
