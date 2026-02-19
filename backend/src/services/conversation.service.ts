import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { dispatchWebhookEvent } from './webhook-dispatcher.service';

export class ConversationService {
  async list(organizationId: string, query: {
    page?: number;
    limit?: number;
    status?: string;
    assigned_to?: string;
    search?: string;
    instance_id?: string;
    label?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organization_id: organizationId,
      NOT: { chat_jid: { endsWith: '@lid' } },
    };

    if (query.status) where.status = query.status;
    if (query.assigned_to === 'unassigned') {
      where.assigned_to_user_id = null;
    } else if (query.assigned_to) {
      where.assigned_to_user_id = query.assigned_to;
    }
    if (query.instance_id) where.instance_id = query.instance_id;
    if (query.label) {
      where.contact = {
        ...where.contact,
        contact_tags: { some: { tag: { name: query.label } } },
      };
    }

    if (query.search) {
      where.OR = [
        { contact: { name: { contains: query.search } } },
        { contact: { phone_number: { contains: query.search } } },
        { last_message_preview: { contains: query.search } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { last_message_at: 'desc' },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              avatar_url: true,
              stage: true,
            },
          },
          assigned_to_user: {
            select: { id: true, name: true, avatar_url: true },
          },
          assigned_to_team: {
            select: { id: true, name: true, color: true },
          },
          labels: true,
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organization_id: organizationId },
      include: {
        contact: true,
        assigned_to_user: {
          select: { id: true, name: true, avatar_url: true, role: true },
        },
        assigned_to_team: {
          select: { id: true, name: true, color: true },
        },
        labels: true,
        instance: {
          select: { id: true, name: true, wa_instance_id: true, phone_number: true },
        },
      },
    });

    if (!conversation) {
      throw AppError.notFound('Conversation not found');
    }

    return conversation;
  }

  async findOrCreate(organizationId: string, instanceId: string, chatJid: string, contactId: string) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        organization_id: organizationId,
        instance_id: instanceId,
        chat_jid: chatJid,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organization_id: organizationId,
          instance_id: instanceId,
          contact_id: contactId,
          chat_jid: chatJid,
          status: 'OPEN',
        },
      });
    }

    return conversation;
  }

  async assign(organizationId: string, conversationId: string, userId?: string, teamId?: string, assignedById?: string) {
    const conversation = await this.getById(organizationId, conversationId);

    // Deactivate previous assignments
    await prisma.conversationAssignment.updateMany({
      where: { conversation_id: conversationId, is_active: true },
      data: { is_active: false, unassigned_at: new Date() },
    });

    // Create new assignment
    await prisma.conversationAssignment.create({
      data: {
        conversation_id: conversationId,
        user_id: userId || null,
        team_id: teamId || null,
        assigned_by_id: assignedById || null,
      },
    });

    // Update conversation
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assigned_to_user_id: userId || null,
        assigned_to_team_id: teamId || null,
        status: 'OPEN',
      },
      include: {
        contact: { select: { id: true, name: true, phone_number: true, avatar_url: true } },
        assigned_to_user: { select: { id: true, name: true, avatar_url: true } },
        assigned_to_team: { select: { id: true, name: true } },
      },
    });

    dispatchWebhookEvent(organizationId, 'conversation.assigned', {
      conversation_id: conversationId,
      assigned_to_user: updated.assigned_to_user,
      assigned_to_team: updated.assigned_to_team,
      contact: updated.contact,
    });

    return updated;
  }

  async resolve(organizationId: string, conversationId: string, resolvedById: string) {
    await this.getById(organizationId, conversationId);

    const resolved = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date(),
        resolved_by_id: resolvedById,
      },
    });

    dispatchWebhookEvent(organizationId, 'conversation.resolved', {
      conversation_id: conversationId,
      resolved_by: resolvedById,
    });

    return resolved;
  }

  async reopen(organizationId: string, conversationId: string) {
    await this.getById(organizationId, conversationId);

    const reopened = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'OPEN',
        resolved_at: null,
        resolved_by_id: null,
      },
    });

    dispatchWebhookEvent(organizationId, 'conversation.reopened', {
      conversation_id: conversationId,
    });

    return reopened;
  }

  async updateLastMessage(organizationId: string, conversationId: string, preview: string, direction: 'INCOMING' | 'OUTGOING') {
    const updateData: any = {
      last_message_at: new Date(),
      last_message_preview: preview.substring(0, 200),
      last_message_direction: direction,
      total_messages: { increment: 1 },
    };

    if (direction === 'INCOMING') {
      updateData.unread_count = { increment: 1 };
    }

    await prisma.conversation.update({
      where: { id: conversationId, organization_id: organizationId },
      data: updateData,
    });
  }

  /**
   * Return all tags for the organization.
   * All roles see the same tag options; data isolation is enforced
   * by the list() method which filters conversations by assigned_to for AGENT.
   */
  async listLabels(organizationId: string) {
    const rows = await prisma.tag.findMany({
      where: { organization_id: organizationId },
      select: { name: true, color: true },
      orderBy: { name: 'asc' },
    });

    return rows.map((r) => ({ label: r.name, color: r.color }));
  }

  async markAsRead(organizationId: string, conversationId: string) {
    await this.getById(organizationId, conversationId);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { unread_count: 0 },
    });
  }
}

export const conversationService = new ConversationService();
