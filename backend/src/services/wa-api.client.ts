import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

/**
 * WAApiClient — matches friend's WhatsApp API blueprint.
 *
 * Base URL stored in DB should be: http://localhost:3001/api/v1
 * All paths below are relative to that base URL.
 */
export class WAApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  static async forOrganization(organizationId: string): Promise<WAApiClient> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { wa_api_base_url: true, wa_api_key: true },
    });

    if (!org || !org.wa_api_base_url || !org.wa_api_key) {
      throw AppError.badRequest('WhatsApp API not configured for this organization');
    }

    return new WAApiClient(org.wa_api_base_url, org.wa_api_key);
  }

  // ===== Instance Management =====
  // GET /instances
  async getInstances() {
    const { data } = await this.client.get('/instances');
    return data;
  }

  // GET /instances then filter by ID (no per-instance endpoint)
  async getInstance(instanceId: string) {
    const { data } = await this.client.get('/instances');
    const list = data?.data || data || [];
    const instance = list.find((i: any) => i.id === instanceId || i.instance_id === instanceId);
    return instance || null;
  }

  // Get instance status from list
  async getInstanceStatus(instanceId: string) {
    const instance = await this.getInstance(instanceId);
    if (!instance) return null;
    return {
      status: instance.status?.toLowerCase() || 'disconnected',
      phone_number: instance.phone_number || null,
      name: instance.name || null,
      is_active: instance.is_active || false,
    };
  }

  // QR code is only available via WA API Dashboard (port 3000), not via REST API
  async getInstanceQR(_instanceId: string) {
    return { qr: null, message: 'QR Code hanya tersedia di WA API Dashboard (port 3000). Buka dashboard untuk scan QR.' };
  }

  // ===== Messaging =====
  // POST /messages/send-text
  async sendText(instanceId: string, phone: string, message: string, chatJid?: string) {
    const to = (chatJid && chatJid.endsWith('@lid')) ? chatJid : phone;
    const { data } = await this.client.post('/messages/send-text', {
      instance_id: instanceId,
      to,
      message,
    });
    return data;
  }

  // POST /messages/send-media
  async sendMedia(instanceId: string, phone: string, message: string, mediaUrl: string, mediaType?: string, chatJid?: string) {
    const to = (chatJid && chatJid.endsWith('@lid')) ? chatJid : phone;
    const { data } = await this.client.post('/messages/send-media', {
      instance_id: instanceId,
      to,
      media_url: mediaUrl,
      media_type: mediaType || 'image',
      caption: message || undefined,
    });
    return data;
  }

  // GET /messages?instance_id=x&phone_number=x&limit=50
  // For @lid JIDs, use chat_jid param instead of phone_number
  async getMessageHistory(instanceId: string, phoneNumber: string, limit = 50, chatJid?: string) {
    const params: any = { instance_id: instanceId, limit };
    if (chatJid && chatJid.endsWith('@lid')) {
      params.chat_jid = chatJid;
    } else {
      params.phone_number = phoneNumber;
    }
    const { data } = await this.client.get('/messages', { params });
    return data;
  }

  // GET /messages?instance_id=x&search=keyword
  async searchMessages(instanceId: string, search: string, limit = 50) {
    const { data } = await this.client.get('/messages', {
      params: { instance_id: instanceId, search, limit },
    });
    return data;
  }

  // ===== Contacts =====
  // GET /contacts?instance_id=x
  async getContacts(instanceId: string, page = 1, limit = 50) {
    const { data } = await this.client.get('/contacts', {
      params: { instance_id: instanceId, page, limit },
    });
    return data;
  }

  // GET /contacts/:id
  async getContact(contactId: string) {
    const { data } = await this.client.get(`/contacts/${contactId}`);
    return data;
  }

  // POST /contacts
  async createContact(instanceId: string, phone: string, name?: string, tags?: string[], notes?: string) {
    const { data } = await this.client.post('/contacts', {
      instance_id: instanceId,
      phone_number: phone,
      name,
      tags,
      notes,
    });
    return data;
  }

  // PATCH /contacts/:id
  async updateContact(contactId: string, updates: { name?: string; tags?: string[]; notes?: string; custom_fields?: Record<string, string> }) {
    const { data } = await this.client.patch(`/contacts/${contactId}`, updates);
    return data;
  }

  // DELETE /contacts/:id
  async deleteContact(contactId: string) {
    const { data } = await this.client.delete(`/contacts/${contactId}`);
    return data;
  }

  // ===== Conversations =====
  // GET /conversations?instance_id=x
  async getConversations(instanceId?: string, page = 1, limit = 100) {
    const params: any = { page, limit };
    if (instanceId) params.instance_id = instanceId;
    const { data } = await this.client.get('/conversations', { params });
    return data;
  }

  // ===== Webhook Config =====
  // GET /webhook/config
  async getWebhookConfig() {
    const { data } = await this.client.get('/webhook/config');
    return data;
  }

  // PUT /webhook/config
  async setWebhookConfig(instanceId: string, url: string, events?: string[], secret?: string) {
    const { data } = await this.client.put('/webhook/config', {
      instance_id: instanceId,
      url,
      events: events || ['message.received', 'message.sent', 'message.delivered', 'message.read'],
      secret,
    });
    return data;
  }

  // DELETE /webhook/config/:instanceId
  async deleteWebhookConfig(instanceId: string) {
    const { data } = await this.client.delete(`/webhook/config/${instanceId}`);
    return data;
  }
}
