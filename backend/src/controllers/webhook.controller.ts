import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service';
import { env } from '../config/env';
import { messageService } from '../services/message.service';
import { prisma } from '../config/database';
import { conversationService } from '../services/conversation.service';
import { paymentCallbackService } from '../services/payment-callback.service';
import crypto from 'crypto';

export class WebhookController {
  async handleWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
    // Verify webhook signature if secret is configured
    if (env.WEBHOOK_SECRET) {
      const signature = req.headers['x-webhook-signature'] as string;
      if (!signature) {
        console.warn('Webhook signature header missing');
        res.status(401).json({ error: 'Missing webhook signature' });
        return;
      }

      const bodyStr = JSON.stringify(req.body);
      const expectedHex = crypto
        .createHmac('sha256', env.WEBHOOK_SECRET)
        .update(bodyStr)
        .digest('hex');

      // WA API sends "sha256=<hex>" format — strip prefix for comparison
      const receivedHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;

      if (receivedHex !== expectedHex) {
        console.warn('Webhook signature mismatch');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    // Respond immediately to avoid timeout
    res.status(200).json({ received: true });

    // Process webhook asynchronously
    const { event, instance_id, data } = req.body;

    console.log(`Webhook received: ${event} from instance ${instance_id}`);

    try {
      switch (event) {
        case 'message.received':
        case 'messages.upsert':
          await webhookService.handleIncomingMessage({ instance_id, data });
          break;

        case 'message.sent':
          await webhookService.handleOutgoingMessage({ instance_id, data });
          break;

        case 'message.delivered':
          await webhookService.handleMessageStatus({ instance_id, data: { ...data, status: 'DELIVERED' } });
          break;

        case 'message.read':
          await webhookService.handleMessageStatus({ instance_id, data: { ...data, status: 'READ' } });
          break;

        case 'message.status':
        case 'message.update':
          await webhookService.handleMessageStatus({ instance_id, data });
          break;

        case 'instance.status':
        case 'connection.update':
        case 'connection.connected':
        case 'connection.disconnected':
          await webhookService.handleInstanceStatus({ instance_id, data: { ...data, status: event === 'connection.connected' ? 'connected' : (event === 'connection.disconnected' ? 'disconnected' : data?.status) } });
          break;

        case 'lid.mapping.resolved':
          await webhookService.handleLidMappingResolved({ instance_id, data });
          break;

        default:
          console.log(`Webhook: Unhandled event type: ${event}`);
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  }

  /**
   * POST /api/webhook/n8n-reply
   *
   * Callback endpoint for n8n (or any external automation) to send replies
   * back to WhatsApp via CRM. Used when n8n processes asynchronously and
   * cannot return the reply in the original webhook HTTP response.
   *
   * Authentication: WEBHOOK_SECRET via X-Webhook-Secret header, OR
   *                 organization's wa_api_key via X-API-Key header.
   *
   * Body:
   *   {
   *     "organization_id": "uuid",        // required
   *     "conversation_id": "uuid",        // required if phone_number not provided
   *     "phone_number": "628xxx",         // required if conversation_id not provided
   *     "message": "Balasan dari AI"      // required — the reply text
   *   }
   */
  async handleN8nReply(req: Request, res: Response, _next: NextFunction): Promise<void> {
    // --- Authentication ---
    const apiKey = req.headers['x-api-key'] as string;
    const webhookSecret = req.headers['x-webhook-secret'] as string;

    const { organization_id, conversation_id, phone_number, message } = req.body;

    if (!organization_id) {
      res.status(400).json({ error: 'organization_id is required' });
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'message is required and must be a non-empty string' });
      return;
    }

    if (!conversation_id && !phone_number) {
      res.status(400).json({ error: 'Either conversation_id or phone_number is required' });
      return;
    }

    // Verify auth: check WEBHOOK_SECRET or organization's wa_api_key
    // AND verify organization exists and is active
    let authenticated = false;

    const org = await prisma.organization.findUnique({
      where: { id: organization_id },
      select: { id: true, is_active: true, wa_api_key: true },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    if (!org.is_active) {
      res.status(403).json({ error: 'Organization is deactivated' });
      return;
    }

    if (env.WEBHOOK_SECRET && webhookSecret === env.WEBHOOK_SECRET) {
      authenticated = true;
    }

    if (!authenticated && apiKey) {
      if (org.wa_api_key && org.wa_api_key === apiKey) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      console.warn('n8n-reply: Authentication failed');
      res.status(401).json({ error: 'Unauthorized. Provide X-Webhook-Secret or X-API-Key header.' });
      return;
    }

    // --- Find or resolve conversation ---
    try {
      let resolvedConversationId = conversation_id;

      if (!resolvedConversationId && phone_number) {
        // Find conversation by phone_number
        const contact = await prisma.contact.findFirst({
          where: { organization_id, phone_number },
        });

        if (!contact) {
          res.status(404).json({ error: `Contact not found for phone_number: ${phone_number}` });
          return;
        }

        const conversation = await prisma.conversation.findFirst({
          where: { organization_id, contact_id: contact.id },
          orderBy: { last_message_at: 'desc' },
        });

        if (!conversation) {
          res.status(404).json({ error: `No conversation found for phone_number: ${phone_number}` });
          return;
        }

        resolvedConversationId = conversation.id;
      }

      console.log(`📥 n8n-reply received → org: ${organization_id}, conversation: ${resolvedConversationId}, message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);

      const result = await messageService.sendText(
        organization_id,
        resolvedConversationId,
        message.trim(),
        null,
      );

      console.log(`✅ n8n-reply sent successfully → message_id: ${result.id}, status: ${result.status}`);

      res.status(200).json({
        success: true,
        message_id: result.id,
        status: result.status,
      });
    } catch (err: any) {
      console.error(`❌ n8n-reply failed: ${err.message}`);
      res.status(500).json({ error: err.message || 'Failed to send reply' });
    }
  }

  async handlePaymentCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      // Verify webhook secret (optional but recommended)
      const secret = req.headers['x-webhook-secret'] as string;
      if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
        res.status(401).json({ error: 'Invalid or missing webhook secret' });
        return;
      }

      const { tracking_code, deal_id, phone_number, amount, payment_method, payment_ref, payer_name, metadata } = req.body;

      if (!amount || typeof amount !== 'number') {
        res.status(400).json({ error: 'amount (number) is required' });
        return;
      }

      if (!tracking_code && !deal_id && !phone_number) {
        res.status(400).json({ error: 'At least one identifier required: tracking_code, deal_id, or phone_number' });
        return;
      }

      const result = await paymentCallbackService.processPayment({
        tracking_code,
        deal_id,
        phone_number,
        amount,
        payment_method,
        payment_ref,
        payer_name,
        metadata,
      });

      res.status(result.success ? 200 : 404).json(result);
    } catch (err: any) {
      console.error(`❌ payment-callback failed: ${err.message}`);
      res.status(500).json({ error: err.message || 'Failed to process payment' });
    }
  }
}

export const webhookController = new WebhookController();
