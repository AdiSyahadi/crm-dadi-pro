import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateDealInput, UpdateDealInput, ListDealsInput, DealReportInput } from '../validators/deal.validator';
import { dispatchWebhookEvent } from './webhook-dispatcher.service';

async function generateDealNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.deal.count({
    where: {
      organization_id: organizationId,
      deal_number: { startsWith: `DEAL-${year}` },
    },
  });
  return `DEAL-${year}-${String(count + 1).padStart(4, '0')}`;
}

export class DealService {
  async list(organizationId: string, input: ListDealsInput) {
    const { page, limit, stage, closed_status, assigned_to, pipeline, search, sort_by, sort_order } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId, is_archived: false };

    if (stage) where.stage = stage;
    if (closed_status) where.closed_status = closed_status;
    if (assigned_to) where.assigned_to_id = assigned_to;
    if (pipeline) where.pipeline = pipeline;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { deal_number: { contains: search } },
        { contact: { name: { contains: search } } },
      ];
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          contact: { select: { id: true, name: true, phone_number: true, avatar_url: true } },
          assigned_to: { select: { id: true, name: true, avatar_url: true } },
        },
      }),
      prisma.deal.count({ where }),
    ]);

    return {
      deals,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async pipeline(organizationId: string, pipelineName = 'default') {
    const stages = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING'];

    const deals = await prisma.deal.findMany({
      where: {
        organization_id: organizationId,
        pipeline: pipelineName,
        is_archived: false,
        stage: { in: stages as any },
      },
      include: {
        contact: { select: { id: true, name: true, phone_number: true, avatar_url: true } },
        assigned_to: { select: { id: true, name: true, avatar_url: true } },
      },
      orderBy: { updated_at: 'desc' },
    });

    const grouped: Record<string, any[]> = {};
    for (const stage of stages) {
      grouped[stage] = deals.filter((d: any) => d.stage === stage);
    }

    // Summary for WON/LOST
    const [wonCount, lostCount, wonValue, lostValue] = await Promise.all([
      prisma.deal.count({ where: { organization_id: organizationId, pipeline: pipelineName, closed_status: 'WON' } }),
      prisma.deal.count({ where: { organization_id: organizationId, pipeline: pipelineName, closed_status: 'LOST' } }),
      prisma.deal.aggregate({ where: { organization_id: organizationId, pipeline: pipelineName, closed_status: 'WON' }, _sum: { value: true } }),
      prisma.deal.aggregate({ where: { organization_id: organizationId, pipeline: pipelineName, closed_status: 'LOST' }, _sum: { value: true } }),
    ]);

    return {
      stages: grouped,
      summary: {
        won: { count: wonCount, value: wonValue._sum.value || 0 },
        lost: { count: lostCount, value: lostValue._sum.value || 0 },
      },
    };
  }

  async getById(organizationId: string, dealId: string) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organization_id: organizationId },
      include: {
        contact: true,
        conversation: { select: { id: true, chat_jid: true, status: true } },
        assigned_to: { select: { id: true, name: true, avatar_url: true, role: true } },
        activities: {
          orderBy: { created_at: 'desc' },
          take: 20,
        },
      },
    });

    if (!deal) throw AppError.notFound('Deal not found');
    return deal;
  }

  async create(organizationId: string, userId: string, input: CreateDealInput) {
    const dealNumber = await generateDealNumber(organizationId);

    const deal = await prisma.deal.create({
      data: {
        organization_id: organizationId,
        contact_id: input.contact_id,
        conversation_id: input.conversation_id || null,
        title: input.title,
        description: input.description || null,
        deal_number: dealNumber,
        stage: (input.stage as any) || 'QUALIFICATION',
        pipeline: input.pipeline || 'default',
        value: input.value || 0,
        currency: input.currency || 'IDR',
        win_probability: input.win_probability || 0,
        assigned_to_id: input.assigned_to_id || null,
        expected_close_date: input.expected_close_date ? new Date(input.expected_close_date) : null,
        products: input.products ? JSON.parse(JSON.stringify(input.products)) : null,
        source: input.source || null,
        custom_fields: input.custom_fields ? JSON.parse(JSON.stringify(input.custom_fields)) : null,
      },
    });

    await prisma.dealActivity.create({
      data: {
        deal_id: deal.id,
        user_id: userId,
        type: 'CREATED',
        title: `Deal created: ${deal.title}`,
        metadata: JSON.parse(JSON.stringify({ deal_number: dealNumber, stage: deal.stage })),
      },
    });

    const fullDeal = await this.getById(organizationId, deal.id);
    dispatchWebhookEvent(organizationId, 'deal.created', { deal: fullDeal });
    return fullDeal;
  }

  async update(organizationId: string, userId: string, dealId: string, input: UpdateDealInput) {
    const existing = await this.getById(organizationId, dealId);

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.value !== undefined) updateData.value = input.value;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.win_probability !== undefined) updateData.win_probability = input.win_probability;
    if (input.assigned_to_id !== undefined) updateData.assigned_to_id = input.assigned_to_id;
    if (input.expected_close_date !== undefined) updateData.expected_close_date = new Date(input.expected_close_date);
    if (input.products !== undefined) updateData.products = JSON.parse(JSON.stringify(input.products));
    if (input.source !== undefined) updateData.source = input.source;
    if (input.custom_fields !== undefined) updateData.custom_fields = JSON.parse(JSON.stringify(input.custom_fields));

    await prisma.deal.update({ where: { id: dealId }, data: updateData });

    // Track value change
    if (input.value !== undefined && Number(existing.value) !== input.value) {
      await prisma.dealActivity.create({
        data: {
          deal_id: dealId,
          user_id: userId,
          type: 'VALUE_CHANGED',
          title: `Value changed from ${existing.value} to ${input.value}`,
          metadata: JSON.parse(JSON.stringify({ old_value: Number(existing.value), new_value: input.value })),
        },
      });
    }

    // Track assignment change
    if (input.assigned_to_id !== undefined && existing.assigned_to_id !== input.assigned_to_id) {
      await prisma.dealActivity.create({
        data: {
          deal_id: dealId,
          user_id: userId,
          type: 'ASSIGNED',
          title: `Deal assigned to new user`,
          metadata: JSON.parse(JSON.stringify({ old_assigned: existing.assigned_to_id, new_assigned: input.assigned_to_id })),
        },
      });
    }

    return this.getById(organizationId, dealId);
  }

  async moveStage(organizationId: string, userId: string, dealId: string, newStage: string) {
    const existing = await this.getById(organizationId, dealId);
    const oldStage = existing.stage;

    await prisma.deal.update({
      where: { id: dealId },
      data: { stage: newStage as any },
    });

    await prisma.dealActivity.create({
      data: {
        deal_id: dealId,
        user_id: userId,
        type: 'STAGE_CHANGED',
        title: `Stage changed from ${oldStage} to ${newStage}`,
        metadata: JSON.parse(JSON.stringify({ old_stage: oldStage, new_stage: newStage })),
      },
    });

    const movedDeal = await this.getById(organizationId, dealId);
    dispatchWebhookEvent(organizationId, 'deal.stage_changed', { deal: movedDeal, old_stage: oldStage, new_stage: newStage });
    return movedDeal;
  }

  async markWon(organizationId: string, userId: string, dealId: string, wonNotes?: string, actualCloseDate?: string) {
    await this.getById(organizationId, dealId);

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        stage: 'WON',
        closed_status: 'WON',
        won_notes: wonNotes || null,
        actual_close_date: actualCloseDate ? new Date(actualCloseDate) : new Date(),
        win_probability: 100,
      },
    });

    await prisma.dealActivity.create({
      data: {
        deal_id: dealId,
        user_id: userId,
        type: 'WON',
        title: 'Deal marked as WON',
        metadata: wonNotes ? JSON.parse(JSON.stringify({ won_notes: wonNotes })) : undefined,
      },
    });

    const wonDeal = await this.getById(organizationId, dealId);
    dispatchWebhookEvent(organizationId, 'deal.won', { deal: wonDeal });
    return wonDeal;
  }

  async markLost(organizationId: string, userId: string, dealId: string, lostReason: string, actualCloseDate?: string) {
    await this.getById(organizationId, dealId);

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        stage: 'LOST',
        closed_status: 'LOST',
        lost_reason: lostReason,
        actual_close_date: actualCloseDate ? new Date(actualCloseDate) : new Date(),
        win_probability: 0,
      },
    });

    await prisma.dealActivity.create({
      data: {
        deal_id: dealId,
        user_id: userId,
        type: 'LOST',
        title: 'Deal marked as LOST',
        metadata: JSON.parse(JSON.stringify({ lost_reason: lostReason })),
      },
    });

    const lostDeal = await this.getById(organizationId, dealId);
    dispatchWebhookEvent(organizationId, 'deal.lost', { deal: lostDeal, lost_reason: lostReason });
    return lostDeal;
  }

  async reopen(organizationId: string, userId: string, dealId: string) {
    await this.getById(organizationId, dealId);

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        stage: 'QUALIFICATION',
        closed_status: null,
        lost_reason: null,
        won_notes: null,
        actual_close_date: null,
        win_probability: 0,
      },
    });

    await prisma.dealActivity.create({
      data: {
        deal_id: dealId,
        user_id: userId,
        type: 'REOPENED',
        title: 'Deal reopened',
      },
    });

    return this.getById(organizationId, dealId);
  }

  async addNote(organizationId: string, userId: string, dealId: string, note: string) {
    await this.getById(organizationId, dealId);

    await prisma.dealActivity.create({
      data: {
        deal_id: dealId,
        user_id: userId,
        type: 'NOTE_ADDED',
        title: 'Note added',
        description: note,
      },
    });

    return this.getById(organizationId, dealId);
  }

  async delete(organizationId: string, dealId: string) {
    await this.getById(organizationId, dealId);
    await prisma.deal.delete({ where: { id: dealId } });
  }

  async getClosingReport(organizationId: string, input: DealReportInput) {
    const where: any = { organization_id: organizationId };

    if (input.pipeline) where.pipeline = input.pipeline;
    if (input.start_date || input.end_date) {
      where.created_at = {};
      if (input.start_date) where.created_at.gte = new Date(input.start_date);
      if (input.end_date) where.created_at.lte = new Date(input.end_date);
    }

    const [totalDeals, wonDeals, lostDeals, wonValue, lostValue, allDeals] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.count({ where: { ...where, closed_status: 'WON' } }),
      prisma.deal.count({ where: { ...where, closed_status: 'LOST' } }),
      prisma.deal.aggregate({ where: { ...where, closed_status: 'WON' }, _sum: { value: true }, _avg: { value: true } }),
      prisma.deal.aggregate({ where: { ...where, closed_status: 'LOST' }, _sum: { value: true } }),
      prisma.deal.findMany({
        where: { ...where, closed_status: { not: null } },
        select: {
          id: true,
          value: true,
          closed_status: true,
          stage: true,
          source: true,
          lost_reason: true,
          assigned_to_id: true,
          assigned_to: { select: { id: true, name: true } },
          created_at: true,
          actual_close_date: true,
        },
      }),
    ]);

    // By agent
    const agentMap = new Map<string, { name: string; won: number; lost: number; revenue: number }>();
    for (const deal of allDeals) {
      const agentId = deal.assigned_to_id || 'unassigned';
      const agentName = deal.assigned_to?.name || 'Unassigned';
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { name: agentName, won: 0, lost: 0, revenue: 0 });
      }
      const agent = agentMap.get(agentId)!;
      if (deal.closed_status === 'WON') {
        agent.won++;
        agent.revenue += Number(deal.value);
      } else {
        agent.lost++;
      }
    }

    // By source
    const sourceMap = new Map<string, { won: number; lost: number; revenue: number }>();
    for (const deal of allDeals) {
      const source = deal.source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { won: 0, lost: 0, revenue: 0 });
      }
      const s = sourceMap.get(source)!;
      if (deal.closed_status === 'WON') {
        s.won++;
        s.revenue += Number(deal.value);
      } else {
        s.lost++;
      }
    }

    // Lost reasons
    const lostReasonMap = new Map<string, number>();
    for (const deal of allDeals) {
      if (deal.closed_status === 'LOST' && deal.lost_reason) {
        lostReasonMap.set(deal.lost_reason, (lostReasonMap.get(deal.lost_reason) || 0) + 1);
      }
    }

    // Avg closing days
    let totalClosingDays = 0;
    let closedCount = 0;
    for (const deal of allDeals) {
      if (deal.actual_close_date && deal.created_at) {
        const days = Math.ceil((new Date(deal.actual_close_date).getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24));
        totalClosingDays += days;
        closedCount++;
      }
    }

    const winRate = totalDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

    return {
      summary: {
        total_deals: totalDeals,
        won_count: wonDeals,
        lost_count: lostDeals,
        open_count: totalDeals - wonDeals - lostDeals,
        won_value: Number(wonValue._sum.value || 0),
        lost_value: Number(lostValue._sum.value || 0),
        avg_deal_value: Number(wonValue._avg.value || 0),
        win_rate: winRate,
        avg_closing_days: closedCount > 0 ? Math.round(totalClosingDays / closedCount) : 0,
      },
      by_agent: Array.from(agentMap.entries()).map(([id, data]) => ({
        agent_id: id,
        ...data,
        win_rate: (data.won + data.lost) > 0 ? Math.round((data.won / (data.won + data.lost)) * 100) : 0,
      })),
      by_source: Array.from(sourceMap.entries()).map(([source, data]) => ({
        source,
        ...data,
      })),
      lost_reasons: Array.from(lostReasonMap.entries()).map(([reason, count]) => ({
        reason,
        count,
      })).sort((a, b) => b.count - a.count),
    };
  }
}

export const dealService = new DealService();
