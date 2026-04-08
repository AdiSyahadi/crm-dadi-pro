import { prisma } from '../config/database';

class ForecastingService {
  async getForecast(organizationId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // ── Pipeline deals (open) ──
    const openDeals = await prisma.deal.findMany({
      where: {
        organization_id: organizationId,
        is_archived: false,
        stage: { in: ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING'] },
      },
      select: { id: true, stage: true, value: true, win_probability: true, expected_close_date: true },
    });

    // Stage-based default probabilities
    const stageProbability: Record<string, number> = {
      QUALIFICATION: 10,
      PROPOSAL: 30,
      NEGOTIATION: 50,
      CLOSING: 80,
    };

    // Weighted pipeline value
    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;
    const stageBreakdown: Record<string, { count: number; value: number; weighted: number }> = {};

    for (const deal of openDeals) {
      const val = Number(deal.value || 0);
      const prob = deal.win_probability > 0 ? deal.win_probability : (stageProbability[deal.stage] ?? 0);
      const weighted = val * (prob / 100);

      totalPipelineValue += val;
      weightedPipelineValue += weighted;

      if (!stageBreakdown[deal.stage]) {
        stageBreakdown[deal.stage] = { count: 0, value: 0, weighted: 0 };
      }
      stageBreakdown[deal.stage].count++;
      stageBreakdown[deal.stage].value += val;
      stageBreakdown[deal.stage].weighted += weighted;
    }

    // ── Win/Loss rates ──
    const [wonLast30, lostLast30, wonLast60, lostLast60, wonLast90, lostLast90] = await Promise.all([
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'WON', actual_close_date: { gte: thirtyDaysAgo } } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'LOST', actual_close_date: { gte: thirtyDaysAgo } } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'WON', actual_close_date: { gte: sixtyDaysAgo } } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'LOST', actual_close_date: { gte: sixtyDaysAgo } } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'WON', actual_close_date: { gte: ninetyDaysAgo } } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'LOST', actual_close_date: { gte: ninetyDaysAgo } } }),
    ]);

    const winRate30 = wonLast30 + lostLast30 > 0 ? Math.round((wonLast30 / (wonLast30 + lostLast30)) * 100) : 0;
    const winRate60 = wonLast60 + lostLast60 > 0 ? Math.round((wonLast60 / (wonLast60 + lostLast60)) * 100) : 0;
    const winRate90 = wonLast90 + lostLast90 > 0 ? Math.round((wonLast90 / (wonLast90 + lostLast90)) * 100) : 0;

    // ── Revenue (actual won) ──
    const [revLast30, revLast60, revLast90] = await Promise.all([
      prisma.deal.aggregate({ where: { organization_id: organizationId, closed_status: 'WON', actual_close_date: { gte: thirtyDaysAgo } }, _sum: { value: true } }),
      prisma.deal.aggregate({ where: { organization_id: organizationId, closed_status: 'WON', actual_close_date: { gte: sixtyDaysAgo } }, _sum: { value: true } }),
      prisma.deal.aggregate({ where: { organization_id: organizationId, closed_status: 'WON', actual_close_date: { gte: ninetyDaysAgo } }, _sum: { value: true } }),
    ]);

    const revenue30 = Number(revLast30._sum.value || 0);
    const revenue60 = Number(revLast60._sum.value || 0);
    const revenue90 = Number(revLast90._sum.value || 0);

    // Monthly average revenue (last 90 days)
    const monthlyAvgRevenue = revenue90 / 3;

    // Projected revenue next 30 days = weighted pipeline + trend
    const projectedRevenue = weightedPipelineValue + monthlyAvgRevenue;

    // ── Deals closing soon (expected_close_date within 30 days) ──
    const closingSoon = await prisma.deal.findMany({
      where: {
        organization_id: organizationId,
        is_archived: false,
        stage: { in: ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING'] },
        expected_close_date: { gte: now, lte: thirtyDaysAgo.getTime() < now.getTime() ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : now },
      },
      select: {
        id: true, title: true, deal_number: true, stage: true, value: true,
        expected_close_date: true, win_probability: true,
        contact: { select: { name: true } },
        assigned_to: { select: { name: true } },
      },
      orderBy: { expected_close_date: 'asc' },
      take: 10,
    });

    return {
      pipeline: {
        total_deals: openDeals.length,
        total_value: totalPipelineValue,
        weighted_value: Math.round(weightedPipelineValue),
        stage_breakdown: stageBreakdown,
      },
      win_rate: {
        last_30_days: winRate30,
        last_60_days: winRate60,
        last_90_days: winRate90,
        won_30: wonLast30,
        lost_30: lostLast30,
      },
      revenue: {
        last_30_days: revenue30,
        last_60_days: revenue60,
        last_90_days: revenue90,
        monthly_average: Math.round(monthlyAvgRevenue),
      },
      forecast: {
        projected_revenue_30d: Math.round(projectedRevenue),
        weighted_pipeline: Math.round(weightedPipelineValue),
        trend_based: Math.round(monthlyAvgRevenue),
      },
      closing_soon: closingSoon,
    };
  }
}

export const forecastingService = new ForecastingService();
