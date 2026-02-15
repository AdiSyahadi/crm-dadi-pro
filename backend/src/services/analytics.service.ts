import { prisma } from '../config/database';

export class AnalyticsService {
  async getDashboard(organizationId: string) {
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

    return {
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
  }

  async getMessageVolume(organizationId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = await prisma.message.findMany({
      where: {
        organization_id: organizationId,
        created_at: { gte: startDate },
      },
      select: {
        direction: true,
        created_at: true,
      },
    });

    // Group by date
    const volumeMap = new Map<string, { incoming: number; outgoing: number }>();
    for (const msg of messages) {
      const dateKey = msg.created_at.toISOString().split('T')[0]!;
      if (!volumeMap.has(dateKey)) {
        volumeMap.set(dateKey, { incoming: 0, outgoing: 0 });
      }
      const entry = volumeMap.get(dateKey)!;
      if (msg.direction === 'INCOMING') entry.incoming++;
      else entry.outgoing++;
    }

    return Array.from(volumeMap.entries())
      .map(([date, data]) => ({ date, ...data, total: data.incoming + data.outgoing }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAgentPerformance(organizationId: string) {
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

    return performance;
  }

  async getContactGrowth(organizationId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const contacts = await prisma.contact.findMany({
      where: {
        organization_id: organizationId,
        created_at: { gte: startDate },
      },
      select: { created_at: true, source: true },
    });

    const growthMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();

    for (const contact of contacts) {
      const dateKey = contact.created_at.toISOString().split('T')[0]!;
      growthMap.set(dateKey, (growthMap.get(dateKey) || 0) + 1);
      sourceMap.set(contact.source, (sourceMap.get(contact.source) || 0) + 1);
    }

    return {
      daily: Array.from(growthMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      by_source: Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count })),
    };
  }
}

export const analyticsService = new AnalyticsService();
