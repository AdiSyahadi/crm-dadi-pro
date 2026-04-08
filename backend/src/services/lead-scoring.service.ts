import { prisma } from '../config/database';

// Scoring weights
const SCORE_WEIGHTS = {
  // Stage scores
  stage: {
    NEW: 5,
    LEAD: 15,
    QUALIFIED: 30,
    CUSTOMER: 40,
    VIP: 50,
    CHURNED: -10,
  } as Record<string, number>,

  // Message activity (capped at 30)
  messagePoints: (count: number) => Math.min(Math.floor(count / 5) * 2, 30),

  // Conversation count (capped at 10)
  conversationPoints: (count: number) => Math.min(count * 3, 10),

  // Deal value contribution (capped at 20)
  dealPoints: (deals: { stage: string; value: number | null }[]) => {
    if (deals.length === 0) return 0;
    let pts = deals.length * 2; // 2 pts per deal
    for (const d of deals) {
      if (d.stage === 'WON') pts += 5;
      else if (d.stage === 'NEGOTIATION') pts += 3;
      else if (d.stage === 'PROPOSAL') pts += 2;
    }
    return Math.min(pts, 20);
  },

  // Recency bonus (last message within X days)
  recencyPoints: (lastMessageAt: Date | null) => {
    if (!lastMessageAt) return 0;
    const daysSince = (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 1) return 15;
    if (daysSince <= 3) return 12;
    if (daysSince <= 7) return 8;
    if (daysSince <= 14) return 5;
    if (daysSince <= 30) return 2;
    return 0;
  },

  // Has email bonus
  emailBonus: (email: string | null) => (email ? 3 : 0),
};

function calculateScore(contact: {
  stage: string;
  total_messages: number;
  last_message_at: Date | null;
  email: string | null;
  _count: { conversations: number };
  deals: { stage: string; value: any }[];
}): number {
  const stageScore = SCORE_WEIGHTS.stage[contact.stage] ?? 0;
  const msgScore = SCORE_WEIGHTS.messagePoints(contact.total_messages);
  const convScore = SCORE_WEIGHTS.conversationPoints(contact._count.conversations);
  const dealScore = SCORE_WEIGHTS.dealPoints(
    contact.deals.map((d) => ({ stage: d.stage, value: d.value ? Number(d.value) : null }))
  );
  const recencyScore = SCORE_WEIGHTS.recencyPoints(contact.last_message_at);
  const emailScore = SCORE_WEIGHTS.emailBonus(contact.email);

  // Total: max theoretical ~128, normalized to 0-100
  const raw = stageScore + msgScore + convScore + dealScore + recencyScore + emailScore;
  return Math.max(0, Math.min(100, raw));
}

class LeadScoringService {
  /**
   * Recalculate lead score for a single contact
   */
  async scoreContact(contactId: string, organizationId: string): Promise<number> {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organization_id: organizationId },
      select: {
        stage: true,
        total_messages: true,
        last_message_at: true,
        email: true,
        _count: { select: { conversations: true } },
        deals: { select: { stage: true, value: true } },
      },
    });

    if (!contact) return 0;

    const score = calculateScore(contact);

    await prisma.contact.update({
      where: { id: contactId },
      data: { lead_score: score },
    });

    return score;
  }

  /**
   * Recalculate lead scores for all contacts in an organization
   */
  async scoreAll(organizationId: string): Promise<{ updated: number }> {
    const contacts = await prisma.contact.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        stage: true,
        total_messages: true,
        last_message_at: true,
        email: true,
        _count: { select: { conversations: true } },
        deals: { select: { stage: true, value: true } },
      },
    });

    let updated = 0;
    // Batch update in chunks to avoid overwhelming DB
    const batchSize = 100;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((c) =>
          prisma.contact.update({
            where: { id: c.id },
            data: { lead_score: calculateScore(c) },
          })
        )
      );
      updated += batch.length;
    }

    return { updated };
  }
}

export const leadScoringService = new LeadScoringService();
