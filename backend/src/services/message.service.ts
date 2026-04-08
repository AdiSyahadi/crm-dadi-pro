import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { WAApiClient } from './wa-api.client';
import { conversationService } from './conversation.service';
import { getIO } from '../socket/io';

export class MessageService {
  private async emitChatMessage(organizationId: string, conversationId: string, message: any) {
    const io = getIO();
    if (!io) return;

    const conversation = await conversationService.getById(organizationId, conversationId);

    io.to(`org:${organizationId}`).emit('chat:message', {
      conversation,
      message,
    });

    if (conversation.assigned_to_user_id) {
      io.to(`user:${conversation.assigned_to_user_id}`).emit('chat:message', {
        conversation,
        message,
      });
    }
  }

  async getByConversation(organizationId: string, conversationId: string, query: {
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where = { conversation_id: conversationId, organization_id: organizationId };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          sent_by_user: {
            select: { id: true, name: true, avatar_url: true },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return {
      messages: messages.reverse(),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async sendText(organizationId: string, conversationId: string, content: string, userId: string | null) {
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

    // Emit realtime FIRST so clients see the message immediately,
    // even if the metadata update below were to fail.
    await this.emitChatMessage(organizationId, conversationId, message);

    // Update conversation last message metadata
    await conversationService.updateLastMessage(organizationId, conversationId, content, 'OUTGOING');

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

    // Emit realtime FIRST so clients see the message immediately,
    // even if the metadata update below were to fail.
    await this.emitChatMessage(organizationId, conversationId, message);

    // Update conversation last message metadata
    await conversationService.updateLastMessage(organizationId, conversationId, caption || `[${mediaType}]`, 'OUTGOING');

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
    await conversationService.updateLastMessage(data.organizationId, data.conversationId, preview, direction);

    return message;
  }

  async updateStatus(waMessageId: string, status: string, organizationId?: string | null) {
    const where: any = { wa_message_id: waMessageId };
    if (organizationId) {
      where.organization_id = organizationId;
    }

    const message = await prisma.message.findFirst({ where });

    if (!message) return null;

    return prisma.message.update({
      where: { id: message.id },
      data: { status: status.toUpperCase() as any },
    });
  }

  /**
   * Delete / recall a message.
   * 1. Verify message belongs to org + conversation
   * 2. Call WA API to delete on WhatsApp
   * 3. Update message status to DELETED in DB
   */
  async deleteMessage(
    organizationId: string,
    conversationId: string,
    messageId: string,
    deleteFor: 'everyone' | 'me' = 'everyone'
  ) {
    // Find message
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        organization_id: organizationId,
        conversation_id: conversationId,
      },
    });

    if (!message) {
      throw AppError.notFound('Message not found');
    }

    if (message.status === 'DELETED') {
      throw AppError.badRequest('Message already deleted');
    }

    // Get conversation for chat_jid
    const conversation = await conversationService.getById(organizationId, conversationId);

    const instance = await prisma.wAInstance.findUnique({
      where: { id: message.instance_id },
    });

    if (!instance) {
      throw AppError.notFound('WA Instance not found');
    }

    // Call WA API to delete on WhatsApp (only if wa_message_id exists)
    if (message.wa_message_id) {
      try {
        const waClient = await WAApiClient.forOrganization(organizationId);
        await waClient.deleteMessage(
          instance.wa_instance_id,
          message.wa_message_id,
          conversation.chat_jid,
          {
            fromMe: message.direction === 'OUTGOING',
            deleteFor,
          }
        );
      } catch (error: any) {
        const errMsg = error.response?.data?.error?.message
          || error.response?.data?.message
          || error.message
          || 'Gagal menghapus pesan di WhatsApp';
        throw AppError.badRequest(errMsg);
      }
    }

    // Update message status to DELETED in DB
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { status: 'DELETED' },
      include: {
        sent_by_user: {
          select: { id: true, name: true, avatar_url: true },
        },
      },
    });

    return updated;
  }

  /**
   * Edit a sent message.
   * 1. Verify message belongs to org + conversation + is OUTGOING
   * 2. Enforce 15-min window (soft check — WA server also enforces)
   * 3. Call WA API to edit on WhatsApp
   * 4. Update content + is_edited + edited_at in DB
   */
  async editMessage(
    organizationId: string,
    conversationId: string,
    messageId: string,
    newText: string
  ) {
    if (!newText || !newText.trim()) {
      throw AppError.badRequest('new_text cannot be empty');
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        organization_id: organizationId,
        conversation_id: conversationId,
      },
    });

    if (!message) {
      throw AppError.notFound('Message not found');
    }

    if (message.direction !== 'OUTGOING') {
      throw AppError.badRequest('Hanya bisa edit pesan yang kamu kirim');
    }

    if (message.status === 'DELETED') {
      throw AppError.badRequest('Pesan sudah dihapus, tidak bisa diedit');
    }

    // Non-editable message types
    if (['AUDIO', 'STICKER'].includes(message.message_type)) {
      throw AppError.badRequest('Pesan audio/sticker tidak bisa diedit');
    }

    // 15-min window check
    const sentAt = message.created_at.getTime();
    const fifteenMin = 15 * 60 * 1000;
    if (Date.now() - sentAt > fifteenMin) {
      throw AppError.badRequest('Pesan sudah lewat 15 menit, tidak bisa diedit');
    }

    const conversation = await conversationService.getById(organizationId, conversationId);

    const instance = await prisma.wAInstance.findUnique({
      where: { id: message.instance_id },
    });

    if (!instance) {
      throw AppError.notFound('WA Instance not found');
    }

    // Call WA API to edit
    if (message.wa_message_id) {
      try {
        const waClient = await WAApiClient.forOrganization(organizationId);
        await waClient.editMessage(
          instance.wa_instance_id,
          message.wa_message_id,
          conversation.chat_jid,
          newText.trim()
        );
      } catch (error: any) {
        const errMsg = error.response?.data?.error?.message
          || error.response?.data?.message
          || error.message
          || 'Gagal mengedit pesan di WhatsApp';
        throw AppError.badRequest(errMsg);
      }
    }

    // Determine which field to update: caption for media, content for text
    const isMedia = message.media_url && ['IMAGE', 'VIDEO', 'DOCUMENT', 'VIEW_ONCE'].includes(message.message_type);
    const updateData: any = {
      is_edited: true,
      edited_at: new Date(),
    };
    if (isMedia) {
      updateData.caption = newText.trim();
      updateData.content = newText.trim();
    } else {
      updateData.content = newText.trim();
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: updateData,
      include: {
        sent_by_user: {
          select: { id: true, name: true, avatar_url: true },
        },
      },
    });

    return updated;
  }

  async addInternalNote(organizationId: string, conversationId: string, content: string, userId: string) {
    const conversation = await conversationService.getById(organizationId, conversationId);
    const instance = await prisma.wAInstance.findUnique({ where: { id: conversation.instance_id } });
    if (!instance) throw AppError.notFound('WA Instance not found');

    const note = await prisma.message.create({
      data: {
        organization_id: organizationId,
        conversation_id: conversationId,
        instance_id: instance.id,
        direction: 'OUTGOING',
        message_type: 'TEXT',
        content,
        status: 'DELIVERED',
        sent_by_user_id: userId,
        is_internal_note: true,
      },
      include: {
        sent_by_user: { select: { id: true, name: true, avatar_url: true } },
      },
    });

    await this.emitChatMessage(organizationId, conversationId, note);
    return note;
  }
}

export const messageService = new MessageService();
