import { prisma } from '../config/database';
import { WAApiClient } from './wa-api.client';
import { conversationService } from './conversation.service';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SyncService {
  /**
   * Sync conversations and messages from WA API to CRM database.
   * Pulls conversations list, then for each conversation fetches messages.
   */
  async syncFromWaApi(organizationId: string, instanceId: string) {
    const instance = await prisma.wAInstance.findFirst({
      where: { id: instanceId, organization_id: organizationId },
    });

    if (!instance) {
      throw new Error('Instance not found');
    }

    const waClient = await WAApiClient.forOrganization(organizationId);

    // 0. Check if WA account changed — fetch current instance info from WA API
    const remoteInstance = await waClient.getInstance(instance.wa_instance_id);
    const remotePhone = (remoteInstance?.phone_number || '').replace(/:.*$/, '');
    const localPhone = (instance.phone_number || '').replace(/:.*$/, '');

    if (remotePhone && localPhone && remotePhone !== localPhone) {
      // WA account changed! Clean up old data for this instance
      console.log(`📡 Sync: WA account changed from ${localPhone} to ${remotePhone} — cleaning old data`);
      await this._cleanInstanceData(organizationId, instance.id);

      // Update instance phone_number
      await prisma.wAInstance.update({
        where: { id: instance.id },
        data: { phone_number: remoteInstance.phone_number },
      });
    } else if (remotePhone && !localPhone) {
      // Phone was empty, now we have it — just update
      await prisma.wAInstance.update({
        where: { id: instance.id },
        data: { phone_number: remoteInstance.phone_number },
      });
    }

    // Get instance phone number to filter self-chat
    const instancePhone = remotePhone || localPhone;

    // 1. Fetch conversations from WA API — filter by instance_id
    const convResult = await waClient.getConversations(instance.wa_instance_id);
    const remoteConversations = convResult?.data || convResult || [];

    let syncedConversations = 0;
    let syncedMessages = 0;
    let syncedContacts = 0;

    for (const rc of remoteConversations) {
      const chatJid = rc.chat_jid || '';
      if (!chatJid) continue;

      // Skip group chats
      if (chatJid.includes('@g.us')) continue;

      // Determine phone number:
      // 1. WA API /conversations already auto-resolves LID→phone (check rc.phone_number)
      // 2. For @s.whatsapp.net JIDs, extract phone from JID
      // 3. For @lid JIDs without phone_number, try resolveLid endpoint
      // 4. If still no phone → skip (unresolvable LID, WhatsApp limitation)
      let phone = rc.phone_number || '';

      if (!phone && chatJid.endsWith('@s.whatsapp.net')) {
        phone = chatJid.replace(/@s\.whatsapp\.net$/, '');
      }

      if (!phone && chatJid.endsWith('@lid')) {
        try {
          const resolved = await waClient.resolveLid(chatJid, instance.wa_instance_id);
          if (resolved?.phone_number) {
            phone = resolved.phone_number;
            console.log(`📡 Sync: Resolved LID ${chatJid} → ${phone}`);
          }
        } catch (err: any) {
          // resolveLid returns null for 404, throws for other errors
          console.warn(`Sync: Failed to resolve LID ${chatJid}:`, err.message);
        }
      }

      // No phone number = skip (unresolvable LID or invalid data)
      if (!phone) continue;

      // Skip self-chat
      if (instancePhone && phone === instancePhone) continue;

      try {
        // Rate limit protection: delay between API calls
        await sleep(500);

        // 2. Fetch messages first — only create contact/conversation if there are valid messages
        let validMessages: any[] = [];
        try {
          const msgResult = await waClient.getMessageHistory(instance.wa_instance_id, phone, 100, chatJid);
          const remoteMessages = msgResult?.data || msgResult || [];

          for (const rm of remoteMessages) {
            const msgContent = rm.content || rm.body || rm.text || '';
            const waMessageId = rm.wa_message_id || rm.id;
            if (!waMessageId) continue;
            if (!msgContent && !rm.media_url) continue;

            validMessages.push(rm);
          }
        } catch (msgErr: any) {
          console.warn(`Sync: Failed to fetch messages for ${phone}:`, msgErr.message);
        }

        // Skip this conversation entirely if no valid messages after filtering
        if (validMessages.length === 0) continue;

        // Find or create contact — always keyed by real phone number
        let contact = await prisma.contact.findFirst({
          where: { organization_id: organizationId, phone_number: phone },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              organization_id: organizationId,
              instance_id: instance.id,
              phone_number: phone,
              name: rc.contact_name || phone,
              source: 'WHATSAPP',
              first_message_at: rc.last_message_at ? new Date(rc.last_message_at) : new Date(),
              last_message_at: rc.last_message_at ? new Date(rc.last_message_at) : new Date(),
              total_messages: rc.total_messages || 0,
            },
          });
          syncedContacts++;
        }

        // For @lid conversations with resolved phone, store conversation under phone-based JID
        // so chat history is unified under one conversation per contact
        const conversationJid = chatJid.endsWith('@lid') ? `${phone}@s.whatsapp.net` : chatJid;

        // Find or create conversation
        const conversation = await conversationService.findOrCreate(
          organizationId,
          instance.id,
          conversationJid,
          contact.id
        );

        syncedConversations++;

        // Save valid messages
        for (const rm of validMessages) {
          const msgContent = rm.content || rm.body || rm.text || '';
          const waMessageId = rm.wa_message_id || rm.id;

          const existing = await prisma.message.findFirst({
            where: { wa_message_id: waMessageId, organization_id: organizationId },
          });

          if (existing) {
            const updates: Record<string, any> = {};
            if (!existing.content && msgContent) {
              updates.content = msgContent;
            }
            if (!existing.media_url && rm.media_url) {
              updates.media_url = rm.media_url;
            }
            if (Object.keys(updates).length > 0) {
              await prisma.message.update({
                where: { id: existing.id },
                data: updates,
              });
            }
            continue;
          }

          const rawType = (rm.message_type || 'TEXT').toUpperCase();
          const typeMap: Record<string, string> = {
            TEXT: 'TEXT', EXTENDED_TEXT: 'TEXT',
            IMAGE: 'IMAGE', VIDEO: 'VIDEO', AUDIO: 'AUDIO',
            DOCUMENT: 'DOCUMENT', LOCATION: 'LOCATION',
            STICKER: 'STICKER', CONTACT: 'CONTACT_CARD', CONTACT_CARD: 'CONTACT_CARD',
            REACTION: 'REACTION', POLL: 'POLL',
            VIEW_ONCE: 'VIEW_ONCE', VIEWONCE: 'VIEW_ONCE',
            SYSTEM: 'SYSTEM',
          };
          const messageType = typeMap[rawType] || 'OTHER';

          await prisma.message.create({
            data: {
              organization_id: organizationId,
              conversation_id: conversation.id,
              instance_id: instance.id,
              wa_message_id: waMessageId,
              direction: rm.direction === 'OUTGOING' ? 'OUTGOING' : 'INCOMING',
              message_type: messageType as any,
              content: msgContent || null,
              caption: rm.caption || null,
              media_url: rm.media_url || null,
              media_mime_type: rm.media_mime_type || null,
              status: (rm.status || 'DELIVERED').toUpperCase() as any,
              created_at: rm.sent_at ? new Date(rm.sent_at) : (rm.created_at ? new Date(rm.created_at) : new Date()),
            },
          });

          syncedMessages++;
        }

        // Update conversation metadata from actual saved messages in DB
        const latestMsg = await prisma.message.findFirst({
          where: { conversation_id: conversation.id, organization_id: organizationId },
          orderBy: { created_at: 'desc' },
        });
        if (latestMsg) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              last_message_at: latestMsg.created_at,
              last_message_preview: (latestMsg.content || latestMsg.caption || `[${latestMsg.message_type}]`).slice(0, 255),
              last_message_direction: latestMsg.direction,
              total_messages: await prisma.message.count({ where: { conversation_id: conversation.id } }),
            },
          });
        }
      } catch (convErr: any) {
        console.warn(`Sync: Failed to sync conversation ${phone}:`, convErr.message);
      }
    }

    // Update instance last_synced_at
    await prisma.wAInstance.update({
      where: { id: instance.id },
      data: { last_synced_at: new Date() },
    });

    return {
      conversations: syncedConversations,
      messages: syncedMessages,
      contacts: syncedContacts,
    };
  }

  /**
   * Clean all CRM data (conversations, messages, contacts) for a specific instance.
   * Used when WA account changes on the same instance.
   */
  private async _cleanInstanceData(organizationId: string, instanceId: string) {
    // Delete messages for conversations of this instance
    await prisma.message.deleteMany({
      where: { organization_id: organizationId, instance_id: instanceId },
    });

    // Delete conversation assignments and labels
    const convIds = (await prisma.conversation.findMany({
      where: { organization_id: organizationId, instance_id: instanceId },
      select: { id: true },
    })).map(c => c.id);

    if (convIds.length > 0) {
      await prisma.conversationAssignment.deleteMany({
        where: { conversation_id: { in: convIds } },
      });
      await prisma.conversationLabel.deleteMany({
        where: { conversation_id: { in: convIds } },
      });
    }

    // Delete conversations
    await prisma.conversation.deleteMany({
      where: { organization_id: organizationId, instance_id: instanceId },
    });

    // Delete contacts that only belong to this instance
    await prisma.contact.deleteMany({
      where: { organization_id: organizationId, instance_id: instanceId },
    });
  }

  /**
   * Lightweight sync: only fetch conversations list and messages for recently active ones.
   * This avoids hitting WA API rate limits by limiting message fetches.
   */
  async syncRecentMessages(organizationId: string, instanceId: string) {
    const instance = await prisma.wAInstance.findFirst({
      where: { id: instanceId, organization_id: organizationId },
    });
    if (!instance) return { messages: 0 };

    const waClient = await WAApiClient.forOrganization(organizationId);

    // Check if WA account changed — update phone_number if needed
    const remoteInstance = await waClient.getInstance(instance.wa_instance_id);
    const remotePhone = (remoteInstance?.phone_number || '').replace(/:.*$/, '');
    const localPhone = (instance.phone_number || '').replace(/:.*$/, '');

    if (remotePhone && localPhone && remotePhone !== localPhone) {
      // Account changed — trigger full sync instead of lightweight
      console.log(`📡 Poll: WA account changed from ${localPhone} to ${remotePhone} — triggering full sync`);
      await this._cleanInstanceData(organizationId, instance.id);
      await prisma.wAInstance.update({
        where: { id: instance.id },
        data: { phone_number: remoteInstance.phone_number },
      });
      return this.syncFromWaApi(organizationId, instanceId);
    } else if (remotePhone && !localPhone) {
      await prisma.wAInstance.update({
        where: { id: instance.id },
        data: { phone_number: remoteInstance.phone_number },
      });
    }

    // Get instance phone number to filter self-chat
    const instancePhone = remotePhone || localPhone;

    const convResult = await waClient.getConversations(instance.wa_instance_id);
    const remoteConversations = convResult?.data || convResult || [];

    let syncedMessages = 0;

    // Only check top 5 most recent conversations for new messages
    // Skip group chats and conversations without resolvable phone
    const recentConvs = remoteConversations
      .filter((rc: any) => {
        const jid = rc.chat_jid || '';
        if (!jid || jid.includes('@g.us')) return false;
        const ph = rc.phone_number || (jid.endsWith('@s.whatsapp.net') ? jid.replace(/@s\.whatsapp\.net$/, '') : '');
        if (!ph) return false;
        if (instancePhone && ph === instancePhone) return false;
        return true;
      })
      .slice(0, 5);

    for (const rc of recentConvs) {
      const chatJid = rc.chat_jid || '';
      let phone = rc.phone_number || '';
      if (!phone && chatJid.endsWith('@s.whatsapp.net')) {
        phone = chatJid.replace(/@s\.whatsapp\.net$/, '');
      }
      if (!chatJid || !phone) continue;

      // For @lid conversations, lookup by phone-based JID (same as syncFromWaApi stores them)
      const conversationJid = chatJid.endsWith('@lid') ? `${phone}@s.whatsapp.net` : chatJid;

      try {
        const conversation = await prisma.conversation.findFirst({
          where: { organization_id: organizationId, chat_jid: conversationJid },
        });
        if (!conversation) continue;

        const msgResult = await waClient.getMessageHistory(instance.wa_instance_id, phone, 10, chatJid);
        const remoteMessages = msgResult?.data || msgResult || [];

        for (const rm of remoteMessages) {
          const msgContent = rm.content || rm.body || rm.text || '';

          const waMessageId = rm.wa_message_id || rm.id;
          if (!waMessageId) continue;

          const existing = await prisma.message.findFirst({
            where: { wa_message_id: waMessageId, organization_id: organizationId },
          });
          if (existing) continue;

          const rawType = (rm.message_type || 'TEXT').toUpperCase();
          const typeMap: Record<string, string> = {
            TEXT: 'TEXT', EXTENDED_TEXT: 'TEXT',
            IMAGE: 'IMAGE', VIDEO: 'VIDEO', AUDIO: 'AUDIO',
            DOCUMENT: 'DOCUMENT', LOCATION: 'LOCATION',
            STICKER: 'STICKER', CONTACT: 'CONTACT_CARD', CONTACT_CARD: 'CONTACT_CARD',
            REACTION: 'REACTION', POLL: 'POLL',
            VIEW_ONCE: 'VIEW_ONCE', VIEWONCE: 'VIEW_ONCE',
            SYSTEM: 'SYSTEM',
          };
          const messageType = typeMap[rawType] || 'OTHER';
          if (!msgContent && !rm.media_url) continue;

          await prisma.message.create({
            data: {
              organization_id: organizationId,
              conversation_id: conversation.id,
              instance_id: instance.id,
              wa_message_id: waMessageId,
              direction: rm.direction === 'OUTGOING' ? 'OUTGOING' : 'INCOMING',
              message_type: messageType as any,
              content: msgContent || null,
              caption: rm.caption || null,
              media_url: rm.media_url || null,
              media_mime_type: rm.media_mime_type || null,
              status: (rm.status || 'DELIVERED').toUpperCase() as any,
              created_at: rm.sent_at ? new Date(rm.sent_at) : (rm.created_at ? new Date(rm.created_at) : new Date()),
            },
          });
          syncedMessages++;
        }

        // Update conversation metadata from actual saved messages in DB
        const latestMsg = await prisma.message.findFirst({
          where: { conversation_id: conversation.id, organization_id: organizationId },
          orderBy: { created_at: 'desc' },
        });
        if (latestMsg) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              last_message_at: latestMsg.created_at,
              last_message_preview: (latestMsg.content || latestMsg.caption || `[${latestMsg.message_type}]`).slice(0, 255),
              last_message_direction: latestMsg.direction,
            },
          });
        }
      } catch (err: any) {
        // Skip errors silently
      }
    }

    return { messages: syncedMessages };
  }

  /**
   * Start background polling to sync new messages from WA API.
   */
  startPolling(intervalMs = 120_000) {
    console.log(`📡 Sync polling started (every ${intervalMs / 1000}s)`);
    setInterval(async () => {
      try {
        const instances = await prisma.wAInstance.findMany({
          where: { status: 'CONNECTED' },
        });
        for (const inst of instances) {
          try {
            const result = await this.syncRecentMessages(inst.organization_id, inst.id);
            if (result.messages > 0) {
              console.log(`📡 Polled ${result.messages} new messages for instance ${inst.name}`);
            }
          } catch (err: any) {
            // Silently skip errors for individual instances
          }
        }
      } catch (err: any) {
        console.warn('Sync polling error:', err.message);
      }
    }, intervalMs);
  }
}

export const syncService = new SyncService();
