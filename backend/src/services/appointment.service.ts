import { prisma } from '../config/database';

export class AppointmentService {
  async list(organizationId: string, params: {
    page: number;
    limit: number;
    status?: string;
    contact_id?: string;
    assigned_to_id?: string;
    from?: string;
    to?: string;
    sort_by: string;
    sort_order: string;
  }) {
    const where: any = { organization_id: organizationId };
    if (params.status) where.status = params.status;
    if (params.contact_id) where.contact_id = params.contact_id;
    if (params.assigned_to_id) where.assigned_to_id = params.assigned_to_id;
    if (params.from || params.to) {
      where.start_time = {};
      if (params.from) where.start_time.gte = new Date(params.from);
      if (params.to) where.start_time.lte = new Date(params.to);
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phone_number: true } },
          assigned_to: { select: { id: true, name: true } },
          created_by: { select: { id: true, name: true } },
        },
        orderBy: { [params.sort_by]: params.sort_order },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      appointments,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        total_pages: Math.ceil(total / params.limit),
      },
    };
  }

  async getById(id: string, organizationId: string) {
    return prisma.appointment.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        contact: { select: { id: true, name: true, phone_number: true } },
        assigned_to: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
      },
    });
  }

  async create(organizationId: string, userId: string, data: {
    title: string;
    description?: string;
    location?: string;
    start_time: string;
    end_time: string;
    contact_id?: string;
    assigned_to_id?: string;
    notes?: string;
    reminder_at?: string;
  }) {
    return prisma.appointment.create({
      data: {
        organization_id: organizationId,
        created_by_id: userId,
        title: data.title,
        description: data.description,
        location: data.location,
        start_time: new Date(data.start_time),
        end_time: new Date(data.end_time),
        contact_id: data.contact_id,
        assigned_to_id: data.assigned_to_id || userId,
        notes: data.notes,
        reminder_at: data.reminder_at ? new Date(data.reminder_at) : undefined,
      },
      include: {
        contact: { select: { id: true, name: true, phone_number: true } },
        assigned_to: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, organizationId: string, data: {
    title?: string;
    description?: string;
    location?: string;
    start_time?: string;
    end_time?: string;
    contact_id?: string | null;
    assigned_to_id?: string | null;
    status?: string;
    notes?: string;
    reminder_at?: string | null;
  }) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!appointment) return null;

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.start_time !== undefined) updateData.start_time = new Date(data.start_time);
    if (data.end_time !== undefined) updateData.end_time = new Date(data.end_time);
    if (data.contact_id !== undefined) updateData.contact_id = data.contact_id;
    if (data.assigned_to_id !== undefined) updateData.assigned_to_id = data.assigned_to_id;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.reminder_at !== undefined) updateData.reminder_at = data.reminder_at ? new Date(data.reminder_at) : null;

    return prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true, phone_number: true } },
        assigned_to: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string, organizationId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!appointment) return null;
    return prisma.appointment.delete({ where: { id } });
  }
}

export const appointmentService = new AppointmentService();
