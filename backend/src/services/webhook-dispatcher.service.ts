import crypto from 'crypto';
import { prisma } from '../config/database';
import { messageService } from './message.service';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Dispatches CRM events to all active webhook configs for an organization.
 * If the webhook endpoint returns a JSON body with a "reply" field,
 * CRM will automatically send that reply as a WA message to the customer.
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  event: string,
  data: Record<string, any>,
): Promise<void> {
  _dispatch(organizationId, event, data).catch((err) => {
    console.error(`Webhook dispatch error [${event}]:`, err.message);
  });
}

async function _dispatch(
  organizationId: string,
  event: string,
  data: Record<string, any>,
): Promise<void> {
  const configs = await prisma.webhookConfig.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
    },
  });

  if (configs.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  const replyContext = {
    organizationId,
    conversationId: data.conversation_id || null,
  };

  const eventInstanceId = data.instance_id || null;

  const tasks = configs
    .filter((cfg) => {
      // Filter by instance: if webhook is tied to a specific instance, only fire for that instance
      if (cfg.wa_instance_id && eventInstanceId && cfg.wa_instance_id !== eventInstanceId) return false;
      const events = cfg.events as string[] | null;
      if (!events || events.length === 0) return true;
      return events.includes(event);
    })
    .map((cfg) => _sendToWebhook(cfg, body, replyContext));

  await Promise.allSettled(tasks);
}

async function _sendToWebhook(
  config: { id: string; webhook_url: string; webhook_secret: string | null },
  body: string,
  replyContext: { organizationId: string; conversationId: string | null },
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.webhook_secret) {
    const signature = crypto
      .createHmac('sha256', config.webhook_secret)
      .update(body)
      .digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const successData: any = { last_triggered_at: new Date(), failure_count: 0 };
      await prisma.webhookConfig.update({ where: { id: config.id }, data: successData });

      // Read response body — if webhook returns { reply: "..." }, send as WA message
      await _handleWebhookReply(response, replyContext);
    } else {
      console.warn(`Webhook ${config.id} returned ${response.status}: ${response.statusText}`);
      const failData: any = { failure_count: { increment: 1 } };
      await prisma.webhookConfig.update({ where: { id: config.id }, data: failData });
    }
  } catch (err: any) {
    console.warn(`Webhook ${config.id} failed: ${err.message}`);
    const failData: any = { failure_count: { increment: 1 } };
    await prisma.webhookConfig.update({ where: { id: config.id }, data: failData });
  }
}

/**
 * If the webhook response contains a reply, send it as a WA message
 * back to the customer via the existing messageService.sendText flow.
 *
 * Supported response formats from n8n / external webhook:
 *   { "reply": "..." }
 *   { "message": "..." }
 *   { "text": "..." }
 *   { "output": "..." }
 *   { "response": "..." }
 *   { "output": { "text": "..." } }
 *   { "data": { "message": "..." } }
 */
async function _handleWebhookReply(
  response: Response,
  ctx: { organizationId: string; conversationId: string | null },
): Promise<void> {
  if (!ctx.conversationId) {
    console.log('⚠️ Webhook reply skipped: no conversationId in context');
    return;
  }

  try {
    // Try to parse body as JSON regardless of Content-Type
    // (some n8n nodes don't set proper Content-Type header)
    let resBody: any;
    try {
      const rawText = await response.text();
      if (!rawText || rawText.trim().length === 0) {
        console.log('⚠️ Webhook reply skipped: empty response body');
        return;
      }
      resBody = JSON.parse(rawText);
    } catch {
      console.log('⚠️ Webhook reply skipped: response body is not valid JSON');
      return;
    }

    // Extract reply text from multiple possible formats
    const replyText = _extractReplyText(resBody);

    if (!replyText) {
      console.log(`⚠️ Webhook reply skipped: no reply text found in response body. Keys: [${Object.keys(resBody || {}).join(', ')}]`);
      return;
    }

    console.log(`📤 Webhook reply → conversation ${ctx.conversationId}: "${replyText.substring(0, 80)}${replyText.length > 80 ? '...' : ''}"`);

    await messageService.sendText(
      ctx.organizationId,
      ctx.conversationId,
      replyText,
      null,
    );

    console.log(`✅ Webhook reply sent successfully to conversation ${ctx.conversationId}`);
  } catch (err: any) {
    console.error(`❌ Webhook reply processing failed: ${err.message}`);
  }
}

/**
 * Extract reply text from various response formats commonly returned by n8n.
 */
function _extractReplyText(body: any): string | null {
  if (!body || typeof body !== 'object') return null;

  // Direct string fields (priority order)
  const directFields = ['reply', 'message', 'text', 'output', 'response', 'content', 'answer'];
  for (const field of directFields) {
    if (typeof body[field] === 'string' && body[field].trim().length > 0) {
      return body[field].trim();
    }
  }

  // Nested object patterns: { output: { text: "..." } }, { data: { message: "..." } }
  const nestedContainers = ['output', 'data', 'result', 'payload'];
  for (const container of nestedContainers) {
    if (body[container] && typeof body[container] === 'object') {
      for (const field of directFields) {
        if (typeof body[container][field] === 'string' && body[container][field].trim().length > 0) {
          return body[container][field].trim();
        }
      }
    }
  }

  return null;
}
