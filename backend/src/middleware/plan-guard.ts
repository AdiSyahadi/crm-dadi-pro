import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { getPlanLimitsAsync, isWithinQuota, PlanLimits } from '../config/plan-limits';
import { AppError } from '../utils/app-error';

/**
 * Middleware: Require a specific feature to be enabled on the org's plan.
 * Usage: router.post('/broadcasts', requireFeature('broadcast'), ...)
 */
export function requireFeature(feature: keyof PlanLimits['features']) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      // SUPER_ADMIN bypasses all feature restrictions
      if (req.user.role === 'SUPER_ADMIN') {
        next();
        return;
      }

      const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: { plan: true },
      });

      if (!org) {
        throw AppError.notFound('Organization not found');
      }

      const limits = await getPlanLimitsAsync(org.plan);
      if (!limits.features[feature]) {
        throw AppError.forbidden(
          `Fitur ini tidak tersedia di plan ${org.plan}. Silakan upgrade untuk mengakses fitur ini.`,
          'PLAN_FEATURE_RESTRICTED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Resource type for quota checking.
 * Each maps to a Prisma count query and a plan limit field.
 */
type QuotaResource = 'contacts' | 'users' | 'wa_instances' | 'templates'
  | 'broadcasts_monthly' | 'scheduled_messages' | 'deals' | 'tags' | 'webhook_configs';

/**
 * Middleware: Check if the org's quota allows creating one more of a resource.
 * Usage: router.post('/contacts', checkQuota('contacts'), ...)
 */
export function checkQuota(resource: QuotaResource) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      // SUPER_ADMIN bypasses all quota limits
      if (req.user.role === 'SUPER_ADMIN') {
        next();
        return;
      }

      const orgId = req.user.organizationId;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      });

      if (!org) {
        throw AppError.notFound('Organization not found');
      }

      const limits = await getPlanLimitsAsync(org.plan);
      const { current, max, label } = await getQuotaInfo(orgId, resource, limits);

      if (!isWithinQuota(current, max)) {
        const limitText = max === -1 ? 'unlimited' : max.toString();
        throw AppError.forbidden(
          `Batas ${label} untuk plan ${org.plan} sudah tercapai (${current}/${limitText}). Silakan upgrade untuk menambah kapasitas.`,
          'PLAN_QUOTA_EXCEEDED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

async function getQuotaInfo(
  orgId: string,
  resource: QuotaResource,
  limits: PlanLimits
): Promise<{ current: number; max: number; label: string }> {
  switch (resource) {
    case 'contacts': {
      const count = await prisma.contact.count({ where: { organization_id: orgId } });
      return { current: count, max: limits.maxContacts, label: 'kontak' };
    }
    case 'users': {
      const count = await prisma.user.count({ where: { organization_id: orgId, is_active: true } });
      return { current: count, max: limits.maxUsers, label: 'pengguna' };
    }
    case 'wa_instances': {
      const count = await prisma.wAInstance.count({ where: { organization_id: orgId } });
      return { current: count, max: limits.maxWaInstances, label: 'WA instance' };
    }
    case 'templates': {
      const count = await prisma.messageTemplate.count({ where: { organization_id: orgId } });
      return { current: count, max: limits.maxTemplates, label: 'template' };
    }
    case 'broadcasts_monthly': {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const count = await prisma.broadcast.count({
        where: {
          organization_id: orgId,
          created_at: { gte: startOfMonth },
        },
      });
      return { current: count, max: limits.maxBroadcastsPerMonth, label: 'broadcast bulan ini' };
    }
    case 'scheduled_messages': {
      const count = await prisma.scheduledMessage.count({
        where: { organization_id: orgId, is_active: true },
      });
      return { current: count, max: limits.maxScheduledMessages, label: 'jadwal pesan' };
    }
    case 'deals': {
      const count = await prisma.deal.count({
        where: { organization_id: orgId, is_archived: false },
      });
      return { current: count, max: limits.maxDeals, label: 'deal' };
    }
    case 'tags': {
      const count = await prisma.tag.count({ where: { organization_id: orgId } });
      return { current: count, max: limits.maxTags, label: 'label/tag' };
    }
    case 'webhook_configs': {
      const count = await prisma.webhookConfig.count({ where: { organization_id: orgId } });
      return { current: count, max: limits.maxWebhookConfigs, label: 'webhook config' };
    }
    default:
      return { current: 0, max: -1, label: resource };
  }
}
