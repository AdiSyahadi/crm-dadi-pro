import { prisma } from '../config/database';
import { messageService } from './message.service';
import { conversationService } from './conversation.service';
import { getIO } from '../socket/io';
import { dispatchWebhookEvent } from './webhook-dispatcher.service';
import { autoResponseEngine } from './auto-response-engine';

export class WebhookService {
  async handleIncomingMessage(payload: any) {
    const { instance_id, data } = payload;

    if (!instance_id || !data) {
      console.warn('Webhook: Missing instance_id or data');
      return;
    }

    // Find ALL WA instances matching this wa_instance_id (may belong to multiple orgs)
    const instances = await prisma.wAInstance.findMany({
      where: { wa_instance_id: instance_id },
      include: { organization: { select: { id: true } } },
    });

    if (instances.length === 0) {
      console.warn(`Webhook: Unknown instance ${instance_id}`);
      return;
    }

    // Process for each organization that has this instance
    for (const instance of instances) {
      try {
        await this._processIncomingForInstance(instance, data);
      } catch (err: any) {
        console.error(`Webhook: Error processing for org ${instance.organization.id}:`, err.message);
      }
    }
  }

  /**
   * Handle outgoing messages (message.sent webhook event).
   * Saves the outgoing message to CRM so chat history shows both sides.
   */
  async handleOutgoingMessage(payload: any) {
    const { instance_id, data } = payload;
    if (!instance_id || !data) return;

    const instances = await prisma.wAInstance.findMany({
      where: { wa_instance_id: instance_id },
      include: { organization: { select: { id: true } } },
    });

    for (const instance of instances) {
      try {
        await this._processMessageForInstance(instance, data, 'OUTGOING');
      } catch (err: any) {
        console.error(`Webhook outgoing: Error for org ${instance.organization.id}:`, err.message);
      }
    }
  }

  /**
   * Shared handler for both incoming and outgoing messages.
   * Uses phone_number and direction fields from the new webhook payload.
   */
  private async _processMessageForInstance(instance: any, data: any, defaultDirection: 'INCOMING' | 'OUTGOING') {
    const organizationId = instance.organization.id;
    const chatJid = data.chat_jid || data.from || data.key?.remoteJid || (data.phone_number ? `${data.phone_number}@s.whatsapp.net` : null);

    if (!chatJid) {
      console.warn('Webhook: Missing chat_jid');
      return;
    }

    // Skip group chats
    if (chatJid.includes('@g.us')) return;

    // Determine real phone number:
    // 1. Use data.phone_number from webhook (WA API provides resolved phone when available)
    // 2. For @s.whatsapp.net JIDs, extract phone from JID
    // 3. For @lid JIDs without phone_number, try resolveLid endpoint
    // 4. If unresolvable → skip (don't create contact with LID as phone)
    let phone = data.phone_number || '';

    if (!phone && chatJid.endsWith('@s.whatsapp.net')) {
      phone = chatJid.replace(/@s\.whatsapp\.net$/, '');
    }

    if (!phone && chatJid.endsWith('@lid')) {
      try {
        const { WAApiClient } = require('./wa-api.client');
        const waClient = await WAApiClient.forOrganization(organizationId);
        const resolved = await waClient.resolveLid(chatJid, instance.wa_instance_id);
        if (resolved?.phone_number) {
          phone = resolved.phone_number;
        }
      } catch {
        // Could not resolve — skip this message
      }
    }

    if (!phone) return; // Unresolvable LID — skip

    // Skip self-chat
    const instancePhone = (instance.phone_number || '').replace(/:.*$/, '');
    if (instancePhone && phone === instancePhone) return;

    let contact = await prisma.contact.findFirst({
      where: { organization_id: organizationId, phone_number: phone },
    });

    // For INCOMING: push_name/sender_name/notify = the contact who sent the message → safe to use as contact name
    // For OUTGOING: push_name/sender_name/notify = OUR OWN name (the WA account owner) → NEVER use for contact name
    // contact_name = from WA address book, always refers to the conversation partner → safe for both directions
    const contactName = defaultDirection === 'INCOMING'
      ? (data.contact_name || data.push_name || data.sender_name || data.notify || '')
      : (data.contact_name || '');

    let isNewContact = false;
    if (!contact) {
      isNewContact = true;
      contact = await prisma.contact.create({
        data: {
          organization_id: organizationId,
          instance_id: instance.id,
          phone_number: phone,
          name: contactName || phone,
          source: 'WHATSAPP',
          first_message_at: new Date(),
          last_message_at: new Date(),
          total_messages: 1,
        },
      });
    } else {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          last_message_at: new Date(),
          total_messages: { increment: 1 },
          ...(contactName && (contact.name === contact.phone_number || !contact.name) ? { name: contactName } : {}),
        },
      });
    }

    // Always store conversation under phone-based JID to prevent split conversations
    const conversationJid = `${phone}@s.whatsapp.net`;

    // Find or create conversation
    const conversation = await conversationService.findOrCreate(
      organizationId,
      instance.id,
      conversationJid,
      contact.id
    );

    // Determine message type
    const messageType = data.message_type || data.type || 'text';

    // Use direction from webhook payload, fallback to defaultDirection
    const direction = (data.direction === 'OUTGOING' || data.direction === 'INCOMING')
      ? data.direction
      : defaultDirection;

    // Dedup check — webhook may retry, avoid duplicate messages
    const waMessageId = data.message_id || data.id || data.key?.id || '';
    if (waMessageId) {
      const existing = await prisma.message.findFirst({
        where: { wa_message_id: waMessageId, organization_id: organizationId },
      });
      if (existing) return { contact, conversation, message: existing };
    }

    // Dedup check for OUTGOING — CRM sendText() creates a record before webhook arrives.
    // Match by content + conversation + direction within 60s window to avoid duplicates.
    const msgContent = data.content || data.text || data.body || data.message?.conversation || data.message?.extendedTextMessage?.text || null;
    if (direction === 'OUTGOING' && waMessageId && conversation.id) {
      const cutoff = new Date(Date.now() - 60 * 1000);
      const pendingMatch = await prisma.message.findFirst({
        where: {
          conversation_id: conversation.id,
          direction: 'OUTGOING',
          content: msgContent || undefined,
          wa_message_id: null,
          created_at: { gte: cutoff },
        },
        orderBy: { created_at: 'desc' },
      });
      if (pendingMatch) {
        const updated = await prisma.message.update({
          where: { id: pendingMatch.id },
          data: {
            wa_message_id: waMessageId,
            status: 'SENT',
          },
        });
        return { contact, conversation, message: updated };
      }
    }

    // Parse original WA message timestamp (unix epoch seconds or ISO string)
    const sentAt = data.timestamp
      ? new Date(typeof data.timestamp === 'number' && data.timestamp < 1e12 ? data.timestamp * 1000 : data.timestamp)
      : (data.sent_at ? new Date(data.sent_at) : undefined);

    // Save message
    const message = await messageService.saveIncomingMessage({
      organizationId,
      instanceId: instance.id,
      conversationId: conversation.id,
      waMessageId,
      content: data.content || data.text || data.body || data.message?.conversation || data.message?.extendedTextMessage?.text || null,
      messageType,
      mediaUrl: data.media_url || null,
      mediaMimeType: data.mime_type || null,
      caption: data.caption || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      locationName: data.location_name || null,
      locationAddress: data.location_address || null,
      direction,
      sentAt,
    });

    // Emit via Socket.IO to organization room
    const io = getIO();
    if (io) {
      const fullConversation = await conversationService.getById(organizationId, conversation.id);

      io.to(`org:${organizationId}`).emit('chat:message', {
        conversation: fullConversation,
        message,
      });

      if (conversation.assigned_to_user_id) {
        io.to(`user:${conversation.assigned_to_user_id}`).emit('chat:message', {
          conversation: fullConversation,
          message,
        });
      }
    }

    // Dispatch to external webhooks (n8n, etc.)
    const webhookEvent = direction === 'INCOMING' ? 'message.received' : 'message.sent';
    dispatchWebhookEvent(organizationId, webhookEvent, {
      contact: { id: contact.id, name: contact.name, phone_number: contact.phone_number },
      message: { id: message.id, content: message.content, type: message.message_type, direction: message.direction },
      conversation_id: conversation.id,
      instance_id: instance.id,
    });

    // Auto-response evaluation (fire-and-forget, non-blocking)
    if (direction === 'INCOMING') {
      autoResponseEngine.evaluate({
        organizationId,
        instanceId: instance.id,
        waInstanceId: instance.wa_instance_id,
        contactId: contact.id,
        contactName: contact.name || '',
        contactPhone: phone,
        conversationId: conversation.id,
        contactTotalMessages: isNewContact ? 1 : (contact.total_messages || 0) + 1,
        direction,
      }).catch((err: any) => console.error('AutoResponse evaluate error:', err.message));
    }

    return { contact, conversation, message };
  }

  private async _processIncomingForInstance(instance: any, data: any) {
    return this._processMessageForInstance(instance, data, 'INCOMING');
  }

  async handleMessageStatus(payload: any) {
    const { instance_id, data } = payload;
    const messageId = data?.message_id || data?.id;
    if (!messageId || !data?.status) return;

    // Resolve organization from instance for tenant-scoped update
    let organizationId: string | null = null;
    if (instance_id) {
      const instance = await prisma.wAInstance.findFirst({
        where: { wa_instance_id: instance_id },
        select: { organization_id: true },
      });
      organizationId = instance?.organization_id || null;
    }

    const message = await messageService.updateStatus(messageId, data.status, organizationId);

    if (message) {
      const io = getIO();
      if (io) {
        io.to(`org:${message.organization_id}`).emit('message:status', {
          message_id: message.id,
          wa_message_id: message.wa_message_id,
          conversation_id: message.conversation_id,
          status: message.status,
        });
      }
    }

    return message;
  }

  /**
   * Handle lid.mapping.resolved webhook event.
   * When WA API resolves a LID → phone number, update any CRM contacts
   * that were stored with the LID and merge conversations.
   */
  async handleLidMappingResolved(payload: any) {
    const { instance_id, data } = payload;
    if (!data?.lid_jid || !data?.phone_number) return;

    const instances = await prisma.wAInstance.findMany({
      where: { wa_instance_id: instance_id },
      include: { organization: { select: { id: true } } },
    });

    for (const instance of instances) {
      const organizationId = instance.organization.id;
      const lidNumber = data.lid_jid.replace(/@lid$/, '');
      const realPhone = data.phone_number;

      // Find contact with LID as phone_number
      const lidContact = await prisma.contact.findFirst({
        where: { organization_id: organizationId, phone_number: lidNumber },
      });

      if (!lidContact) continue;

      // Check if a contact with the real phone already exists
      const realContact = await prisma.contact.findFirst({
        where: { organization_id: organizationId, phone_number: realPhone },
      });

      if (realContact) {
        // Merge: move LID contact's conversations to real contact, then delete LID contact
        await prisma.conversation.updateMany({
          where: { contact_id: lidContact.id, organization_id: organizationId },
          data: { contact_id: realContact.id },
        });
        await prisma.message.updateMany({
          where: { organization_id: organizationId, conversation_id: { in: (await prisma.conversation.findMany({ where: { contact_id: realContact.id }, select: { id: true } })).map(c => c.id) } },
          data: {},
        });
        await prisma.contact.delete({ where: { id: lidContact.id } });
        console.log(`📡 LID resolved: merged ${lidNumber} → ${realPhone} (contact ${realContact.id})`);
      } else {
        // Just update the LID contact's phone_number to real phone
        await prisma.contact.update({
          where: { id: lidContact.id },
          data: { phone_number: realPhone },
        });
        // Also update conversation JIDs from LID to phone-based
        await prisma.conversation.updateMany({
          where: { contact_id: lidContact.id, organization_id: organizationId, chat_jid: `${lidNumber}@lid` },
          data: { chat_jid: `${realPhone}@s.whatsapp.net` },
        });
        console.log(`📡 LID resolved: updated contact ${lidContact.id} phone ${lidNumber} → ${realPhone}`);
      }
    }
  }

  async handleInstanceStatus(payload: any) {
    const { instance_id, data } = payload;
    if (!instance_id) return;

    const instances = await prisma.wAInstance.findMany({
      where: { wa_instance_id: instance_id },
    });

    if (instances.length === 0) return;

    const newStatus = data?.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED';

    for (const instance of instances) {
      await prisma.wAInstance.update({
        where: { id: instance.id },
        data: {
          status: newStatus as any,
          phone_number: data?.phone_number || instance.phone_number,
          ...(data?.wa_display_name ? { wa_display_name: data.wa_display_name } : {}),
          last_synced_at: new Date(),
          ...(newStatus === 'CONNECTED' ? { connected_at: new Date() } : {}),
        },
      });

      const io = getIO();
      if (io) {
        io.to(`org:${instance.organization_id}`).emit('instance:status', {
          instance_id: instance.id,
          wa_instance_id: instance.wa_instance_id,
          status: newStatus,
          phone_number: data?.phone_number,
          wa_display_name: data?.wa_display_name,
        });
      }
    }
  }
}

export const webhookService = new WebhookService();
