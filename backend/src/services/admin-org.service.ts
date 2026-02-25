import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

interface ListOrgsQuery {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  status?: string; // active | inactive | trial | expired
}

export class AdminOrgService {
  async list(query: ListOrgsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { slug: { contains: query.search } },
      ];
    }

    if (query.plan) {
      where.plan = query.plan;
    }

    if (query.status === 'active') where.is_active = true;
    if (query.status === 'inactive') where.is_active = false;
    if (query.status === 'trial') where.subscription_status = 'TRIAL';
    if (query.status === 'expired') where.subscription_status = 'EXPIRED';

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          subscription_status: true,
          subscription_expires_at: true,
          is_active: true,
          trial_ends_at: true,
          created_at: true,
          _count: {
            select: { users: true, contacts: true, conversations: true },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        subscription_plan: true,
        _count: {
          select: {
            users: true,
            contacts: true,
            conversations: true,
            broadcasts: true,
            deals: true,
            templates: true,
            wa_instances: true,
            scheduled_messages: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            is_active: true,
            is_online: true,
            last_seen_at: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
        invoices: {
          orderBy: { created_at: 'desc' },
          take: 10,
          include: {
            plan: { select: { name: true, plan_code: true } },
          },
        },
      },
    });

    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');
    return org;
  }

  async changePlan(orgId: string, planCode: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');

    // Validate plan exists
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { plan_code: planCode as any },
    });
    if (!plan) throw AppError.notFound('Plan tidak ditemukan');

    return prisma.organization.update({
      where: { id: orgId },
      data: {
        plan: planCode as any,
        subscription_plan_id: plan.id,
        subscription_status: planCode === 'FREE' ? 'TRIAL' : 'ACTIVE',
      },
    });
  }

  async toggleActive(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');

    return prisma.organization.update({
      where: { id: orgId },
      data: { is_active: !org.is_active },
    });
  }

  async setSubscriptionExpiry(orgId: string, expiresAt: Date) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');

    return prisma.organization.update({
      where: { id: orgId },
      data: { subscription_expires_at: expiresAt },
    });
  }

  async setSubscriptionStatus(orgId: string, status: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');

    return prisma.organization.update({
      where: { id: orgId },
      data: { subscription_status: status as any },
    });
  }
}

export const adminOrgService = new AdminOrgService();
