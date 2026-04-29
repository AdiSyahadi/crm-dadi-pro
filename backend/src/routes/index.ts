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
import scheduledMessageRoutes from './scheduled-message.routes';
import webhookConfigRoutes from './webhook-config.routes';
import autoResponseRoutes from './auto-response.routes';
import notificationRoutes from './notification.routes';
import quickReplyRoutes from './quick-reply.routes';
import csatRoutes from './csat.routes';
import slaRoutes from './sla.routes';
import savedFilterRoutes from './saved-filter.routes';
import holidayRoutes from './holiday.routes';
import exportRoutes from './export.routes';
import chatbotRoutes from './chatbot.routes';
import internalChatRoutes from './internal-chat.routes';
import adminPlanRoutes from './admin-plan.routes';
import adminOrgRoutes from './admin-org.routes';
import adminDashboardRoutes from './admin-dashboard.routes';
import invoiceRoutes from './invoice.routes';
import pricingRoutes from './pricing.routes';
import paymentSettingsRoutes from './payment-settings.routes';
import trackedLinkRoutes from './tracked-link.routes';
import receiptRoutes from './receipt.routes';
import taskRoutes from './task.routes';
import activityLogRoutes from './activity-log.routes';
import appointmentRoutes from './appointment.routes';

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
router.use('/scheduled-messages', scheduledMessageRoutes);
router.use('/webhook-configs', webhookConfigRoutes);
router.use('/auto-responses', autoResponseRoutes);
router.use('/notifications', notificationRoutes);
router.use('/quick-replies', quickReplyRoutes);
router.use('/csat', csatRoutes);
router.use('/sla', slaRoutes);
router.use('/saved-filters', savedFilterRoutes);
router.use('/holidays', holidayRoutes);
router.use('/export', exportRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/internal-chat', internalChatRoutes);
router.use('/tracked-links', trackedLinkRoutes);
router.use('/receipts', receiptRoutes);
router.use('/tasks', taskRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/appointments', appointmentRoutes);

// Admin routes (Super Admin only)
router.use('/admin/plans', adminPlanRoutes);
router.use('/admin/organizations', adminOrgRoutes);
router.use('/admin/dashboard', adminDashboardRoutes);

// Invoice routes (admin + tenant)
router.use('/invoices', invoiceRoutes);

// Payment settings (admin bank accounts + Midtrans config)
router.use('/payment-settings', paymentSettingsRoutes);

// Public pricing
router.use('/pricing', pricingRoutes);

// Webhook (public, verified by signature)
router.use('/webhook', webhookRoutes);

export default router;
