import { prisma } from '../config/database';

export class AdminStatsService {
  async getDashboard() {
    const [
      totalOrgs,
      activeOrgs,
      trialOrgs,
      totalUsers,
      orgsByPlan,
      recentInvoices,
      revenue,
      pendingPayments,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { is_active: true } }),
      prisma.organization.count({ where: { subscription_status: 'TRIAL' } }),
      prisma.user.count(),
      prisma.organization.groupBy({
        by: ['plan'],
        _count: { id: true },
        orderBy: { plan: 'asc' },
      }),
      prisma.invoice.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        include: {
          organization: { select: { name: true, slug: true } },
          plan: { select: { name: true, plan_code: true } },
        },
      }),
      prisma.invoice.aggregate({
        where: { status: 'VERIFIED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.invoice.count({ where: { status: 'PAID' } }), // Awaiting verification
    ]);

    return {
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        trial: trialOrgs,
        inactive: totalOrgs - activeOrgs,
      },
      users: {
        total: totalUsers,
      },
      planDistribution: orgsByPlan.map((g) => ({
        plan: g.plan,
        count: g._count.id,
      })),
      revenue: {
        totalVerified: revenue._sum.amount || 0,
        verifiedCount: revenue._count.id,
      },
      pendingPayments,
      recentInvoices,
    };
  }
}

export const adminStatsService = new AdminStatsService();
