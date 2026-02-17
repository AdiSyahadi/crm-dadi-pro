import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { WAApiClient } from './wa-api.client';
import { conversationService } from './conversation.service';

export class MessageService {
  async getByConversation(conversationId: string, query: {
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversation_id: conversationId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          sent_by_user: {
            select: { id: true, name: true, avatar_url: true },
          },
        },
      }),
      prisma.message.count({ where: { conversation_id: conversationId } }),
    ]);

    return {
      messages: messages.reverse(),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async sendText(organizationId: string, conversationId: string, content: string, userId: string) {
    const conversation = await conversationService.getById(organizationId, conversationId);

    const instance = await prisma.wAInstance.findUnique({
      where: { id: conversation.instance_id },
    });

    if (!instance) {
      throw AppError.notFound('WA Instance not found');
    }

    // Save message to DB first
    const message = await prisma.message.create({
      data: {
        organization_id: organizationId,
        conversation_id: conversationId,
        instance_id: instance.id,
        direction: 'OUTGOING',
        message_type: 'TEXT',
        content,
        status: 'PENDING',
        sent_by_user_id: userId,
      },
      include: {
        sent_by_user: {
          select: { id: true, name: true, avatar_url: true },
        },
      },
    });

    // Send via WA API
    try {
      const waClient = await WAApiClient.forOrganization(organizationId);
      const chatJid = conversation.chat_jid;
      const phone = chatJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
      const result = await waClient.sendText(instance.wa_instance_id, phone, content);

      // Update message with WA message ID
      await prisma.message.update({
        where: { id: message.id },
        data: {
          wa_message_id: result?.data?.message_id || result?.message_id || null,
          status: 'SENT',
        },
      });

      message.status = 'SENT' as any;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message
        || 'Gagal mengirim pesan';
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          error_message: errMsg,
        },
      });
      message.status = 'FAILED' as any;
      message.error_message = errMsg;
    }

    // Update conversation last message
    await conversationService.updateLastMessage(conversationId, content, 'OUTGOING');

    return message;
  }

  async sendMedia(organizationId: string, conversationId: string, mediaUrl: string, caption: string | undefined, mediaType: string, userId: string) {
    const conversation = await conversationService.getById(organizationId, conversationId);

    const instance = await prisma.wAInstance.findUnique({
      where: { id: conversation.instance_id },
    });

    if (!instance) {
      throw AppError.notFound('WA Instance not found');
    }

    const message = await prisma.message.create({
      data: {
        organization_id: organizationId,
        conversation_id: conversationId,
        instance_id: instance.id,
        direction: 'OUTGOING',
        message_type: mediaType.toUpperCase() as any,
        content: caption || null,
        caption: caption || null,
        media_url: mediaUrl,
        status: 'PENDING',
        sent_by_user_id: userId,
      },
      include: {
        sent_by_user: {
          select: { id: true, name: true, avatar_url: true },
        },
      },
    });

    try {
      const waClient = await WAApiClient.forOrganization(organizationId);
      const chatJid = conversation.chat_jid;
      const phone = chatJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
      const result = await waClient.sendMedia(instance.wa_instance_id, phone, caption || '', mediaUrl, mediaType);

      await prisma.message.update({
        where: { id: message.id },
        data: {
          wa_message_id: result?.data?.message_id || result?.message_id || null,
          status: 'SENT',
        },
      });

      message.status = 'SENT' as any;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message
        || 'Gagal mengirim media';
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', error_message: errMsg },
      });
      message.status = 'FAILED' as any;
      message.error_message = errMsg;
    }

    await conversationService.updateLastMessage(conversationId, caption || `[${mediaType}]`, 'OUTGOING');

    return message;
  }

  async saveIncomingMessage(data: {
    organizationId: string;
    instanceId: string;
    conversationId: string;
    waMessageId: string;
    content?: string;
    messageType: string;
    mediaUrl?: string;
    mediaMimeType?: string;
    caption?: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    locationAddress?: string;
    direction?: 'INCOMING' | 'OUTGOING';
    sentAt?: Date;
  }) {
    const message = await prisma.message.create({
      data: {
        organization_id: data.organizationId,
        conversation_id: data.conversationId,
        instance_id: data.instanceId,
        wa_message_id: data.waMessageId,
        direction: data.direction || 'INCOMING',
        message_type: (data.messageType || 'TEXT').toUpperCase() as any,
        content: data.content || null,
        caption: data.caption || null,
        media_url: data.mediaUrl || null,
        media_mime_type: data.mediaMimeType || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        location_name: data.locationName || null,
        location_address: data.locationAddress || null,
        status: data.direction === 'OUTGOING' ? 'SENT' : 'RECEIVED',
        ...(data.sentAt ? { created_at: data.sentAt } : {}),
      },
      include: {
        sent_by_user: {
          select: { id: true, name: true, avatar_url: true },
        },
      },
    });

    const direction = data.direction || 'INCOMING';
    const preview = data.content || data.caption || `[${data.messageType}]`;
    await conversationService.updateLastMessage(data.conversationId, preview, direction);

    return message;
  }

  async updateStatus(waMessageId: string, status: string) {
    const message = await prisma.message.findFirst({
      where: { wa_message_id: waMessageId },
    });

    if (!message) return null;

    return prisma.message.update({
      where: { id: message.id },
      data: { status: status.toUpperCase() as any },
    });
  }
}

export const messageService = new MessageService();
