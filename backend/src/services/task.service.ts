import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateTaskInput, UpdateTaskInput, ListTasksInput } from '../validators/task.validator';
import { getIO } from '../socket/io';

export class TaskService {
  async list(organizationId: string, input: ListTasksInput) {
    const { page, limit, status, type, priority, assigned_to, contact_id, deal_id, search, due_from, due_to, sort_by, sort_order } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assigned_to) where.assigned_to_id = assigned_to;
    if (contact_id) where.contact_id = contact_id;
    if (deal_id) where.deal_id = deal_id;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (due_from || due_to) {
      where.due_date = {};
      if (due_from) where.due_date.gte = new Date(due_from);
      if (due_to) where.due_date.lte = new Date(due_to);
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          created_by: { select: { id: true, name: true, avatar_url: true } },
          assigned_to: { select: { id: true, name: true, avatar_url: true } },
          contact: { select: { id: true, name: true, phone_number: true } },
          deal: { select: { id: true, title: true, deal_number: true, stage: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, organization_id: organizationId },
      include: {
        created_by: { select: { id: true, name: true, avatar_url: true } },
        assigned_to: { select: { id: true, name: true, avatar_url: true } },
        contact: { select: { id: true, name: true, phone_number: true } },
        deal: { select: { id: true, title: true, deal_number: true, stage: true } },
        conversation: { select: { id: true, chat_jid: true, status: true } },
      },
    });

    if (!task) throw AppError.notFound('Task not found');
    return task;
  }

  async create(organizationId: string, userId: string, input: CreateTaskInput) {
    const task = await prisma.task.create({
      data: {
        organization_id: organizationId,
        created_by_id: userId,
        title: input.title,
        description: input.description || null,
        type: input.type as any,
        priority: input.priority as any,
        due_date: input.due_date ? new Date(input.due_date) : null,
        reminder_at: input.reminder_at ? new Date(input.reminder_at) : null,
        assigned_to_id: input.assigned_to_id || null,
        contact_id: input.contact_id || null,
        deal_id: input.deal_id || null,
        conversation_id: input.conversation_id || null,
      },
    });

    const fullTask = await this.getById(organizationId, task.id);

    // Notify assigned user via socket
    if (input.assigned_to_id && input.assigned_to_id !== userId) {
      try {
        const io = getIO();
        if (io) io.to(`user:${input.assigned_to_id}`).emit('task:assigned', fullTask);
      } catch {}
    }

    return fullTask;
  }

  async update(organizationId: string, userId: string, taskId: string, input: UpdateTaskInput) {
    const existing = await this.getById(organizationId, taskId);

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.due_date !== undefined) updateData.due_date = input.due_date ? new Date(input.due_date) : null;
    if (input.reminder_at !== undefined) {
      updateData.reminder_at = input.reminder_at ? new Date(input.reminder_at) : null;
      updateData.reminder_sent = false; // Reset reminder flag when reminder time changes
    }
    if (input.assigned_to_id !== undefined) updateData.assigned_to_id = input.assigned_to_id;
    if (input.contact_id !== undefined) updateData.contact_id = input.contact_id;
    if (input.deal_id !== undefined) updateData.deal_id = input.deal_id;
    if (input.conversation_id !== undefined) updateData.conversation_id = input.conversation_id;

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'DONE' && existing.status !== 'DONE') {
        updateData.completed_at = new Date();
      } else if (input.status !== 'DONE') {
        updateData.completed_at = null;
      }
    }

    await prisma.task.update({ where: { id: taskId }, data: updateData });

    // Notify if assigned user changed
    if (input.assigned_to_id && input.assigned_to_id !== existing.assigned_to_id && input.assigned_to_id !== userId) {
      try {
        const io = getIO();
        if (io) {
          const updatedTask = await this.getById(organizationId, taskId);
          io.to(`user:${input.assigned_to_id}`).emit('task:assigned', updatedTask);
        }
      } catch {}
    }

    return this.getById(organizationId, taskId);
  }

  async delete(organizationId: string, taskId: string) {
    await this.getById(organizationId, taskId);
    await prisma.task.delete({ where: { id: taskId } });
  }

  async summary(organizationId: string, userId?: string) {
    const baseWhere: any = { organization_id: organizationId };
    if (userId) baseWhere.assigned_to_id = userId;

    const [todo, inProgress, done, overdue] = await Promise.all([
      prisma.task.count({ where: { ...baseWhere, status: 'TODO' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'DONE' } }),
      prisma.task.count({
        where: {
          ...baseWhere,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          due_date: { lt: new Date() },
        },
      }),
    ]);

    return { todo, in_progress: inProgress, done, overdue };
  }
}

export const taskService = new TaskService();
