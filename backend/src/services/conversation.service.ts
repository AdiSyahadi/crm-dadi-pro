import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { dispatchWebhookEvent } from './webhook-dispatcher.service';
import { notificationService } from './notification.service';
import { getIO } from '../socket/io';
import { csatService } from './csat.service';
import { slaService } from './sla.service';
import { WAApiClient } from './wa-api.client';

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
      // Set SLA deadline for new conversations
      slaService.setSlaDeadline(conversation.id, organizationId).catch(() => {});
    }

    return conversation;
  }

  async assign(organizationId: string, conversationId: string, userId?: string, teamId?: string, assignedById?: string, transferNote?: string) {
    const conversation = await this.getById(organizationId, conversationId);

    // Validate target user belongs to the same organization
    if (userId) {
      const targetUser = await prisma.user.findFirst({
        where: { id: userId, organization_id: organizationId },
        select: { id: true },
      });
      if (!targetUser) {
        throw AppError.badRequest('Target user not found in this organization');
      }
    }

    // Validate target team belongs to the same organization
    if (teamId) {
      const targetTeam = await prisma.team.findFirst({
        where: { id: teamId, organization_id: organizationId },
        select: { id: true },
      });
      if (!targetTeam) {
        throw AppError.badRequest('Target team not found in this organization');
      }
    }

    // Atomic transaction: deactivate old + create new + update conversation
    const updated = await prisma.$transaction(async (tx) => {
      await tx.conversationAssignment.updateMany({
        where: { conversation_id: conversationId, is_active: true },
        data: { is_active: false, unassigned_at: new Date() },
      });

      if (userId || teamId) {
        await tx.conversationAssignment.create({
          data: {
            conversation_id: conversationId,
            user_id: userId || null,
            team_id: teamId || null,
            assigned_by_id: assignedById || null,
          },
        });
      }

      return tx.conversation.update({
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
    });

    dispatchWebhookEvent(organizationId, 'conversation.assigned', {
      conversation_id: conversationId,
      assigned_to_user: updated.assigned_to_user,
      assigned_to_team: updated.assigned_to_team,
      contact: updated.contact,
    });

    // Emit realtime conversation update to all org members
    const io = getIO();
    if (io) {
      io.to(`org:${organizationId}`).emit('conversation:updated', { conversation: updated });
    }

    // Notify assigned user
    if (userId) {
      const contactName = updated.contact?.name || updated.contact?.phone_number || 'Kontak';
      notificationService.notifyAssigned(userId, contactName, conversationId).catch(() => {});
    }

    // Create transfer note as internal note if provided
    if (transferNote && assignedById) {
      prisma.message.create({
        data: {
          organization_id: organizationId,
          instance_id: conversation.instance_id,
          conversation_id: conversationId,
          direction: 'OUTGOING',
          message_type: 'TEXT',
          content: `📋 Transfer Note: ${transferNote}`,
          status: 'DELIVERED',
          is_internal_note: true,
          sent_by_user_id: assignedById,
        },
      }).catch(() => {});
    }

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

    // Send CSAT survey if enabled (fire-and-forget)
    this.sendCSATSurvey(organizationId, conversationId, resolvedById).catch(() => {});

    return resolved;
  }

  private async sendCSATSurvey(organizationId: string, conversationId: string, resolvedById: string) {
    try {
      const settings = await csatService.getSettings(organizationId);
      if (!settings.is_enabled) return;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true, instance: true },
      });
      if (!conversation || !conversation.contact?.phone_number) return;

      // Check no existing CSAT for this conversation
      const hasPending = await csatService.hasPendingCSAT(organizationId, conversationId);
      if (!hasPending) return;

      const waClient = await WAApiClient.forOrganization(organizationId);
      const delay = (settings.delay_minutes || 5) * 60 * 1000;

      setTimeout(async () => {
        try {
          await waClient.sendText(
            conversation.instance.wa_instance_id,
            conversation.contact.phone_number,
            settings.message_template
          );
        } catch (err) {
          console.error('CSAT send failed:', err);
        }
      }, delay);
    } catch (err) {
      console.error('CSAT survey setup failed:', err);
    }
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

    // Reset SLA deadline on reopen
    slaService.setSlaDeadline(conversationId, organizationId).catch(() => {});

    return reopened;
  }

  async updateLastMessage(organizationId: string, conversationId: string, preview: string, direction: 'INCOMING' | 'OUTGOING') {
    const updateData: any = {
      last_message_at: new Date(),
      last_message_preview: preview.substring(0, 500),
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

  async bulkResolve(organizationId: string, conversationIds: string[], resolvedById: string) {
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        organization_id: organizationId,
        status: 'OPEN',
      },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date(),
        resolved_by_id: resolvedById,
      },
    });
    return { updated: result.count };
  }

  async bulkAssign(organizationId: string, conversationIds: string[], userId: string, assignedById: string) {
    // Validate target user
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: { id: true },
    });
    if (!targetUser) throw AppError.badRequest('Target user not found');

    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        organization_id: organizationId,
      },
      data: {
        assigned_to_user_id: userId,
        status: 'OPEN',
      },
    });
    return { updated: result.count };
  }

  async bulkReopen(organizationId: string, conversationIds: string[]) {
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        organization_id: organizationId,
        status: 'RESOLVED',
      },
      data: {
        status: 'OPEN',
        resolved_at: null,
        resolved_by_id: null,
      },
    });
    return { updated: result.count };
  }

  async getSummary(organizationId: string, conversationId: string) {
    const conversation = await this.getById(organizationId, conversationId);

    // Fetch all text messages for summary
    const messages = await prisma.message.findMany({
      where: {
        conversation_id: conversationId,
        organization_id: organizationId,
        message_type: 'TEXT',
        content: { not: null },
      },
      orderBy: { created_at: 'asc' },
      select: {
        content: true,
        direction: true,
        created_at: true,
        is_internal_note: true,
      },
    });

    const customerMessages = messages.filter(m => m.direction === 'INCOMING' && !m.is_internal_note);
    const agentMessages = messages.filter(m => m.direction === 'OUTGOING' && !m.is_internal_note);
    const internalNotes = messages.filter(m => m.is_internal_note);

    // Build extractive summary
    const totalMessages = messages.filter(m => !m.is_internal_note).length;
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    // Extract key topics from customer messages (most frequent words > 3 chars)
    const wordFreq: Record<string, number> = {};
    const stopWords = new Set(['yang', 'dan', 'ini', 'itu', 'untuk', 'dengan', 'dari', 'tidak', 'ada', 'pada', 'kami', 'saya', 'anda', 'bisa', 'akan', 'sudah', 'juga', 'atau', 'jadi', 'tapi', 'kita', 'mau', 'the', 'and', 'this', 'that', 'for', 'with', 'from', 'not', 'have', 'you', 'can', 'will']);
    customerMessages.forEach(m => {
      if (!m.content) return;
      m.content.toLowerCase().replace(/[^a-zA-Z\s]/g, '').split(/\s+/).forEach(w => {
        if (w.length > 3 && !stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1;
      });
    });
    const topKeywords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);

    return {
      conversation_id: conversationId,
      contact_name: conversation.contact?.name || conversation.contact?.phone_number || 'Unknown',
      status: conversation.status,
      total_messages: totalMessages,
      customer_messages: customerMessages.length,
      agent_messages: agentMessages.length,
      internal_notes: internalNotes.length,
      first_message_at: firstMessage?.created_at || null,
      last_message_at: lastMessage?.created_at || null,
      top_keywords: topKeywords,
      first_customer_message: customerMessages[0]?.content?.substring(0, 200) || null,
      last_customer_message: customerMessages[customerMessages.length - 1]?.content?.substring(0, 200) || null,
    };
  }
  async getTotalUnread(organizationId: string): Promise<number> {
    const result = await prisma.conversation.aggregate({
      where: { organization_id: organizationId, status: 'OPEN' },
      _sum: { unread_count: true },
    });
    return result._sum.unread_count || 0;
  }
}

export const conversationService = new ConversationService();
