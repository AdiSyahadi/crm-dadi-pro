import { prisma } from '../config/database';
import { redis } from '../config/redis';

export class AnalyticsService {
  async getDashboard(organizationId: string) {
    // Redis cache — 5 minute TTL to avoid 13 count queries on every page load
    const cacheKey = `analytics:dashboard:${organizationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalContacts,
      totalConversations,
      openConversations,
      totalMessages,
      todayMessages,
      weekMessages,
      totalDeals,
      openDeals,
      wonDeals,
      wonRevenue,
      activeInstances,
      newContactsToday,
      newContactsWeek,
    ] = await Promise.all([
      prisma.contact.count({ where: { organization_id: organizationId } }),
      prisma.conversation.count({ where: { organization_id: organizationId } }),
      prisma.conversation.count({ where: { organization_id: organizationId, status: 'OPEN' } }),
      prisma.message.count({ where: { organization_id: organizationId } }),
      prisma.message.count({ where: { organization_id: organizationId, created_at: { gte: todayStart } } }),
      prisma.message.count({ where: { organization_id: organizationId, created_at: { gte: weekStart } } }),
      prisma.deal.count({ where: { organization_id: organizationId } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: null, is_archived: false } }),
      prisma.deal.count({ where: { organization_id: organizationId, closed_status: 'WON' } }),
      prisma.deal.aggregate({ where: { organization_id: organizationId, closed_status: 'WON' }, _sum: { value: true } }),
      prisma.wAInstance.count({ where: { organization_id: organizationId, status: 'CONNECTED' } }),
      prisma.contact.count({ where: { organization_id: organizationId, created_at: { gte: todayStart } } }),
      prisma.contact.count({ where: { organization_id: organizationId, created_at: { gte: weekStart } } }),
    ]);

    const result = {
      contacts: {
        total: totalContacts,
        new_today: newContactsToday,
        new_this_week: newContactsWeek,
      },
      conversations: {
        total: totalConversations,
        open: openConversations,
      },
      messages: {
        total: totalMessages,
        today: todayMessages,
        this_week: weekMessages,
      },
      deals: {
        total: totalDeals,
        open: openDeals,
        won: wonDeals,
        won_revenue: Number(wonRevenue._sum.value || 0),
      },
      instances: {
        active: activeInstances,
      },
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  async getMessageVolume(organizationId: string, days = 30) {
    const cacheKey = `analytics:msgvol:${organizationId}:${days}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use DB groupBy instead of loading all messages into memory
    const grouped = await prisma.message.groupBy({
      by: ['direction', 'created_at'],
      where: {
        organization_id: organizationId,
        created_at: { gte: startDate },
      },
      _count: true,
    });

    // Aggregate by date
    const volumeMap = new Map<string, { incoming: number; outgoing: number }>();
    for (const row of grouped) {
      const dateKey = row.created_at.toISOString().split('T')[0]!;
      if (!volumeMap.has(dateKey)) {
        volumeMap.set(dateKey, { incoming: 0, outgoing: 0 });
      }
      const entry = volumeMap.get(dateKey)!;
      if (row.direction === 'INCOMING') entry.incoming += row._count;
      else entry.outgoing += row._count;
    }

    const result = Array.from(volumeMap.entries())
      .map(([date, data]) => ({ date, ...data, total: data.incoming + data.outgoing }))
      .sort((a, b) => a.date.localeCompare(b.date));

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  async getAgentPerformance(organizationId: string) {
    const cacheKey = `analytics:agents:${organizationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const agents = await prisma.user.findMany({
      where: { organization_id: organizationId, is_active: true },
      select: {
        id: true,
        name: true,
        avatar_url: true,
        role: true,
        is_online: true,
      },
    });

    const performance = await Promise.all(
      agents.map(async (agent) => {
        const [assignedConversations, resolvedConversations, sentMessages, wonDeals] = await Promise.all([
          prisma.conversation.count({ where: { organization_id: organizationId, assigned_to_user_id: agent.id, status: 'OPEN' } }),
          prisma.conversation.count({ where: { organization_id: organizationId, resolved_by_id: agent.id } }),
          prisma.message.count({ where: { organization_id: organizationId, sent_by_user_id: agent.id } }),
          prisma.deal.count({ where: { organization_id: organizationId, assigned_to_id: agent.id, closed_status: 'WON' } }),
        ]);

        return {
          ...agent,
          assigned_conversations: assignedConversations,
          resolved_conversations: resolvedConversations,
          sent_messages: sentMessages,
          won_deals: wonDeals,
        };
      })
    );

    await redis.set(cacheKey, JSON.stringify(performance), 'EX', 120);
    return performance;
  }

  async getContactGrowth(organizationId: string, days = 30) {
    const cacheKey = `analytics:growth:${organizationId}:${days}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [dailyGroups, sourceGroups] = await Promise.all([
      prisma.contact.groupBy({
        by: ['created_at'],
        where: { organization_id: organizationId, created_at: { gte: startDate } },
        _count: { id: true },
      }),
      prisma.contact.groupBy({
        by: ['source'],
        where: { organization_id: organizationId, created_at: { gte: startDate } },
        _count: { id: true },
      }),
    ]);

    const dailyMap = new Map<string, number>();
    for (const g of dailyGroups) {
      const dateKey = g.created_at.toISOString().split('T')[0]!;
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + g._count.id);
    }

    const result = {
      daily: Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      by_source: sourceGroups.map((g) => ({ source: g.source, count: g._count.id })),
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    return result;
  }
}

export const analyticsService = new AnalyticsService();
