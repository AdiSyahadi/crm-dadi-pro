import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook endpoint - no auth required (verified by signature)
router.post('/wa', webhookController.handleWebhook);

// n8n async reply callback - auth via X-Webhook-Secret or X-API-Key header
router.post('/n8n-reply', webhookController.handleN8nReply);

export default router;
