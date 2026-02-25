import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';

const router = Router();

// GET /api/pricing/plans — public, list active plans
router.get('/plans', async (_req: Request, res: Response) => {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
    select: {
      id: true,
      plan_code: true,
      name: true,
      description: true,
      price: true,
      billing_cycle: true,
      max_users: true,
      max_contacts: true,
      max_wa_instances: true,
      max_templates: true,
      max_broadcasts_per_month: true,
      max_recipients_per_broadcast: true,
      max_scheduled_messages: true,
      max_deals: true,
      max_tags: true,
      max_webhook_configs: true,
      daily_message_limit: true,
      max_import_batch_size: true,
      max_storage_mb: true,
      analytics_max_days: true,
      features: true,
      sort_order: true,
    },
  });

  res.json({ success: true, data: plans });
});

export default router;
