import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service';
import { env } from '../config/env';
import crypto from 'crypto';

export class WebhookController {
  async handleWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
    // Verify webhook signature if secret is configured
    if (env.WEBHOOK_SECRET) {
      const signature = req.headers['x-webhook-signature'] as string;
      if (signature) {
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
}

export const webhookController = new WebhookController();
