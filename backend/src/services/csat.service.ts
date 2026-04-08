import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

export class CSATService {
  // ─── Settings ──────────────────────────────────────────
  async getSettings(organizationId: string) {
    let settings = await prisma.cSATSetting.findUnique({
      where: { organization_id: organizationId },
    });
    if (!settings) {
      settings = await prisma.cSATSetting.create({
        data: {
          organization_id: organizationId,
          message_template: 'Terima kasih telah menghubungi kami! 🙏\n\nBagaimana penilaian Anda terhadap layanan kami?\n\nBalas dengan angka:\n1 ⭐ - Sangat Buruk\n2 ⭐⭐ - Buruk\n3 ⭐⭐⭐ - Cukup\n4 ⭐⭐⭐⭐ - Baik\n5 ⭐⭐⭐⭐⭐ - Sangat Baik',
        },
      });
    }
    return settings;
  }

  async updateSettings(organizationId: string, data: {
    is_enabled?: boolean;
    message_template?: string;
    delay_minutes?: number;
  }) {
    return prisma.cSATSetting.upsert({
      where: { organization_id: organizationId },
      create: {
        organization_id: organizationId,
        message_template: 'Terima kasih telah menghubungi kami! 🙏\n\nBagaimana penilaian Anda terhadap layanan kami?\n\nBalas dengan angka:\n1 ⭐ - Sangat Buruk\n2 ⭐⭐ - Buruk\n3 ⭐⭐⭐ - Cukup\n4 ⭐⭐⭐⭐ - Baik\n5 ⭐⭐⭐⭐⭐ - Sangat Baik',
        ...data,
      },
      update: data,
    });
  }

  // ─── Recording ──────────────────────────────────────────
  async recordResponse(organizationId: string, data: {
    conversation_id: string;
    contact_id: string;
    rating: number;
    feedback?: string;
    resolved_by_id?: string;
  }) {
    if (data.rating < 1 || data.rating > 5) throw AppError.badRequest('Rating harus 1-5');

    // Prevent duplicate CSAT for same conversation
    const existing = await prisma.cSATResponse.findFirst({
      where: { conversation_id: data.conversation_id, organization_id: organizationId },
    });
    if (existing) throw AppError.conflict('CSAT sudah pernah diberikan untuk percakapan ini');

    return prisma.cSATResponse.create({
      data: {
        organization_id: organizationId,
        conversation_id: data.conversation_id,
        contact_id: data.contact_id,
        rating: data.rating,
        feedback: data.feedback || null,
        resolved_by_id: data.resolved_by_id || null,
      },
    });
  }

  // ─── Analytics ──────────────────────────────────────────
  async getAnalytics(organizationId: string, startDate?: string, endDate?: string) {
    const where: any = { organization_id: organizationId };
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const responses = await prisma.cSATResponse.findMany({
      where,
      select: { rating: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });

    const total = responses.length;
    if (total === 0) {
      return {
        total: 0,
        average: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        satisfaction_rate: 0,
      };
    }

    const sum = responses.reduce((acc, r) => acc + r.rating, 0);
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of responses) distribution[r.rating]++;
    const satisfied = distribution[4] + distribution[5];

    return {
      total,
      average: Math.round((sum / total) * 100) / 100,
      distribution,
      satisfaction_rate: Math.round((satisfied / total) * 100),
    };
  }

  async listResponses(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { organization_id: organizationId };

    const [responses, total] = await Promise.all([
      prisma.cSATResponse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.cSATResponse.count({ where }),
    ]);

    return {
      responses,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Check if CSAT pending for a conversation ──────────
  async hasPendingCSAT(organizationId: string, conversationId: string): Promise<boolean> {
    const existing = await prisma.cSATResponse.findFirst({
      where: { organization_id: organizationId, conversation_id: conversationId },
    });
    return !existing;
  }
}

export const csatService = new CSATService();
