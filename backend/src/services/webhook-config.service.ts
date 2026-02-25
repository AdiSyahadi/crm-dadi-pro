import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateWebhookConfigInput, UpdateWebhookConfigInput } from '../validators/webhook-config.validator';

export class WebhookConfigService {
  async list(organizationId: string) {
    return prisma.webhookConfig.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getById(organizationId: string, id: string) {
    const config = await prisma.webhookConfig.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!config) throw AppError.notFound('Webhook config not found');
    return config;
  }

  async create(organizationId: string, input: CreateWebhookConfigInput) {
    return prisma.webhookConfig.create({
      data: {
        organization_id: organizationId,
        name: input.name,
        webhook_url: input.webhook_url,
        webhook_secret: input.webhook_secret ?? null,
        events: input.events,
        wa_instance_id: input.wa_instance_id ?? null,
        is_active: input.is_active ?? true,
      } as any,
    });
  }

  async update(organizationId: string, id: string, input: UpdateWebhookConfigInput) {
    // Verify ownership
    await this.getById(organizationId, id);

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.webhook_url !== undefined) data.webhook_url = input.webhook_url;
    if (input.webhook_secret !== undefined) data.webhook_secret = input.webhook_secret ?? null;
    if (input.events !== undefined) data.events = input.events;
    if (input.wa_instance_id !== undefined) data.wa_instance_id = input.wa_instance_id ?? null;
    if (input.is_active !== undefined) data.is_active = input.is_active;

    return prisma.webhookConfig.update({ where: { id }, data });
  }

  async delete(organizationId: string, id: string) {
    // Verify ownership
    await this.getById(organizationId, id);

    await prisma.webhookConfig.delete({ where: { id } });
  }

  async testWebhook(organizationId: string, id: string) {
    const config = await this.getById(organizationId, id);

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Power WA',
        webhook_config_id: config.id,
      },
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.webhook_secret) {
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', config.webhook_secret)
          .update(JSON.stringify(testPayload))
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 0,
        statusText: err.message || 'Connection failed',
      };
    }
  }
}

export const webhookConfigService = new WebhookConfigService();
