import { z } from 'zod';

export const listAppointmentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
    contact_id: z.string().uuid().optional(),
    assigned_to_id: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort_by: z.enum(['start_time', 'created_at', 'title']).default('start_time'),
    sort_order: z.enum(['asc', 'desc']).default('asc'),
  }),
});

export const createAppointmentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    location: z.string().max(500).optional(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    contact_id: z.string().uuid().optional(),
    assigned_to_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
    reminder_at: z.string().datetime().optional(),
  }),
});

export const updateAppointmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    location: z.string().max(500).optional(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    contact_id: z.string().uuid().nullable().optional(),
    assigned_to_id: z.string().uuid().nullable().optional(),
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
    notes: z.string().max(2000).optional(),
    reminder_at: z.string().datetime().nullable().optional(),
  }),
});

export const appointmentIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
