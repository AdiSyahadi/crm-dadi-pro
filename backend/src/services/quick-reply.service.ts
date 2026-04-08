import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

export class QuickReplyService {
  async list(organizationId: string, search?: string) {
    const where: any = { organization_id: organizationId, is_active: true };
    if (search) {
      where.OR = [
        { shortcut: { contains: search } },
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    return prisma.quickReply.findMany({
      where,
      orderBy: [{ usage_count: 'desc' }, { shortcut: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const qr = await prisma.quickReply.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!qr) throw AppError.notFound('Quick reply not found');
    return qr;
  }

  async create(organizationId: string, data: {
    shortcut: string;
    title: string;
    content: string;
    category?: string;
    media_url?: string;
    media_type?: string;
  }) {
    const existing = await prisma.quickReply.findUnique({
      where: { organization_id_shortcut: { organization_id: organizationId, shortcut: data.shortcut } },
    });
    if (existing) throw AppError.conflict('Shortcut sudah digunakan');

    return prisma.quickReply.create({
      data: {
        organization_id: organizationId,
        shortcut: data.shortcut.toLowerCase().replace(/\s+/g, '-'),
        title: data.title,
        content: data.content,
        category: data.category || null,
        media_url: data.media_url || null,
        media_type: (data.media_type as any) || null,
      },
    });
  }

  async update(organizationId: string, id: string, data: {
    shortcut?: string;
    title?: string;
    content?: string;
    category?: string;
    media_url?: string;
    media_type?: string;
    is_active?: boolean;
  }) {
    await this.getById(organizationId, id);

    if (data.shortcut) {
      const existing = await prisma.quickReply.findUnique({
        where: { organization_id_shortcut: { organization_id: organizationId, shortcut: data.shortcut } },
      });
      if (existing && existing.id !== id) throw AppError.conflict('Shortcut sudah digunakan');
      data.shortcut = data.shortcut.toLowerCase().replace(/\s+/g, '-');
    }

    return prisma.quickReply.update({
      where: { id },
      data: {
        ...(data.shortcut && { shortcut: data.shortcut }),
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.category !== undefined && { category: data.category || null }),
        ...(data.media_url !== undefined && { media_url: data.media_url || null }),
        ...(data.media_type !== undefined && { media_type: (data.media_type as any) || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
    });
  }

  async delete(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    await prisma.quickReply.delete({ where: { id } });
  }

  async incrementUsage(organizationId: string, id: string) {
    await prisma.quickReply.updateMany({
      where: { id, organization_id: organizationId },
      data: { usage_count: { increment: 1 } },
    });
  }

  async search(organizationId: string, query: string) {
    return prisma.quickReply.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        OR: [
          { shortcut: { startsWith: query.toLowerCase() } },
          { title: { contains: query } },
        ],
      },
      orderBy: [{ usage_count: 'desc' }, { shortcut: 'asc' }],
      take: 10,
    });
  }
}

export const quickReplyService = new QuickReplyService();
