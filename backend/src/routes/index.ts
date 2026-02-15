import { Router } from 'express';
import authRoutes from './auth.routes';
import contactRoutes from './contact.routes';
import waInstanceRoutes from './wa-instance.routes';
import conversationRoutes from './conversation.routes';
import dealRoutes from './deal.routes';
import broadcastRoutes from './broadcast.routes';
import templateRoutes from './template.routes';
import analyticsRoutes from './analytics.routes';
import teamRoutes from './team.routes';
import webhookRoutes from './webhook.routes';
import settingsRoutes from './settings.routes';
import mediaRoutes from './media.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// Auth (public + protected)
router.use('/auth', authRoutes);

// Protected API routes
router.use('/contacts', contactRoutes);
router.use('/instances', waInstanceRoutes);
router.use('/conversations', conversationRoutes);
router.use('/deals', dealRoutes);
router.use('/broadcasts', broadcastRoutes);
router.use('/templates', templateRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/teams', teamRoutes);
router.use('/settings', settingsRoutes);
router.use('/media', mediaRoutes);

// Webhook (public, verified by signature)
router.use('/webhook', webhookRoutes);

export default router;
