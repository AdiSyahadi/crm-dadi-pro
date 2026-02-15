import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook endpoint - no auth required (verified by signature)
router.post('/wa', webhookController.handleWebhook);

export default router;
