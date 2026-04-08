import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { WAApiClient } from './wa-api.client';
import { templateService } from './template.service';

/**
 * AutoResponseEngine — Evaluates and sends auto-responses for incoming messages.
 * Called from webhook.service after an incoming message is saved.
 *
 * Triggers:
 * - NEW_CHAT: First message in a brand new conversation (contact.total_messages === 1)
 * - OUTSIDE_HOURS: Message received outside configured business hours
 *
 * Safeguards:
 * - Cooldown: won't re-send same trigger to same contact within cooldown_minutes
 * - Only fires for INCOMING direction
 * - Template variable substitution: {{name}}, {{nama}}, {{phone}}
 */
export class AutoResponseEngine {
  async evaluate(params: {
    organizationId: string;
    instanceId: string;      // CRM instance ID (WAInstance.id)
    waInstanceId: string;     // WA API instance ID (WAInstance.wa_instance_id)
    contactId: string;
    contactName: string;
    contactPhone: string;
    conversationId: string;
    contactTotalMessages: number;
    direction: 'INCOMING' | 'OUTGOING';
  }) {
    // Only evaluate for incoming messages
    if (params.direction !== 'INCOMING') return;

    const rules = await prisma.autoResponse.findMany({
      where: { organization_id: params.organizationId, is_active: true },
      include: { template: true },
    });

    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        const shouldFire = this._shouldFire(rule, params);
        if (!shouldFire) continue;

        // Check cooldown via Redis TTL key — survives restarts, no fragile content matching
        const cooldownKey = `auto_response:${params.organizationId}:${params.contactId}:${rule.trigger}`;
        const inCooldown = await redis.exists(cooldownKey);
        if (inCooldown) continue;

        // Send the auto-response
        await this._send(params, rule);

        // Set cooldown in Redis (TTL = cooldown_minutes)
        const cooldownSeconds = rule.cooldown_minutes * 60;
        if (cooldownSeconds > 0) {
          await redis.set(cooldownKey, '1', 'EX', cooldownSeconds);
        }

        // Increment template usage
        await templateService.incrementUsage(params.organizationId, rule.template_id).catch(() => {});
      } catch (err: any) {
        console.error(`AutoResponse: Error evaluating rule ${rule.trigger}:`, err.message);
      }
    }
  }

  private _shouldFire(rule: any, params: { contactTotalMessages: number; organizationId: string }): boolean {
    switch (rule.trigger) {
      case 'NEW_CHAT':
        // Fire only for the very first message from this contact
        return params.contactTotalMessages <= 1;

      case 'OUTSIDE_HOURS':
        return this._isOutsideHours(rule);

      default:
        return false;
    }
  }

  private _isOutsideHours(rule: {
    business_hour_start: string | null;
    business_hour_end: string | null;
    business_days: any;
    timezone: string;
  }): boolean {
    if (!rule.business_hour_start || !rule.business_hour_end) return false;

    // Get current time in the configured timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: rule.timezone || 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const weekdayName = parts.find(p => p.type === 'weekday')?.value || '';

    // Map weekday name to day number (0=Sun, 1=Mon, ..., 6=Sat)
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayNum = dayMap[weekdayName] ?? new Date().getDay();

    // Check business days
    const businessDays: number[] = Array.isArray(rule.business_days) ? rule.business_days : [1, 2, 3, 4, 5];
    if (!businessDays.includes(dayNum)) return true; // Non-business day → outside hours

    // Parse business hours
    const [startH, startM] = rule.business_hour_start.split(':').map(Number);
    const [endH, endM] = rule.business_hour_end.split(':').map(Number);
    const currentMinutes = hour * 60 + minute;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Outside hours if before start or after end
    return currentMinutes < startMinutes || currentMinutes >= endMinutes;
  }

  private async _send(params: {
    organizationId: string;
    waInstanceId: string;
    contactPhone: string;
    contactName: string;
    conversationId: string;
    instanceId: string;
  }, rule: any) {
    const template = rule.template;
    let content = template.content;

    // Variable substitution
    content = content
      .replace(/\{\{name\}\}/gi, params.contactName || '')
      .replace(/\{\{nama\}\}/gi, params.contactName || '')
      .replace(/\{\{phone\}\}/gi, params.contactPhone || '');

    // Send via WA API
    const waClient = await WAApiClient.forOrganization(params.organizationId);
    const result = await waClient.sendText(params.waInstanceId, params.contactPhone, content);

    // Save outgoing message in DB
    await prisma.message.create({
      data: {
        organization_id: params.organizationId,
        conversation_id: params.conversationId,
        instance_id: params.instanceId,
        direction: 'OUTGOING',
        message_type: 'TEXT',
        content,
        status: 'SENT',
        wa_message_id: result?.data?.message_id || result?.message_id || null,
      },
    });

    console.log(`🤖 AutoResponse [${rule.trigger}] sent to ${params.contactPhone}`);
  }
}

export const autoResponseEngine = new AutoResponseEngine();
