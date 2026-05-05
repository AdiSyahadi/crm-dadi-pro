import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook endpoint - no auth required (verified by signature)
router.post('/wa', webhookController.handleWebhook);

// n8n async reply callback - auth via X-Webhook-Secret or X-API-Key header
router.post('/n8n-reply', webhookController.handleN8nReply);

// Payment callback from external ecommerce/donation - auth via X-Webhook-Secret header
router.post('/payment-callback', webhookController.handlePaymentCallback);

// Midtrans payment notification - no auth header, verified by SHA-512 signature in body
router.post('/midtrans', webhookController.handleMidtransNotification);

// Flip payment callback - no auth header, verified by validation_token
router.post('/flip', webhookController.handleFlipCallback);

export default router;
