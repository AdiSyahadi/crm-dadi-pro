import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateTrackedLinkInput, UpdateTrackedLinkInput, ListTrackedLinksInput } from '../validators/tracked-link.validator';
import crypto from 'crypto';

function generateTrackingCode(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = crypto.randomBytes(7);
  for (let i = 0; i < 7; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `TRK-${code}`;
}

export class TrackedLinkService {
  async list(organizationId: string, input: ListTrackedLinksInput) {
    const { page, limit, deal_id, search } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (deal_id) where.deal_id = deal_id;
    if (search) {
      where.OR = [
        { label: { contains: search } },
        { original_url: { contains: search } },
        { tracking_code: { contains: search } },
      ];
    }

    const [links, total] = await Promise.all([
      prisma.trackedLink.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          deal: { select: { id: true, title: true, deal_number: true } },
        },
      }),
      prisma.trackedLink.count({ where }),
    ]);

    return {
      links,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, id: string) {
    const link = await prisma.trackedLink.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        deal: { select: { id: true, title: true, deal_number: true, contact: { select: { id: true, name: true, phone_number: true } } } },
      },
    });
    if (!link) throw AppError.notFound('Tracked link not found');
    return link;
  }

  async create(organizationId: string, userId: string, input: CreateTrackedLinkInput) {
    // Verify deal belongs to org
    const deal = await prisma.deal.findFirst({
      where: { id: input.deal_id, organization_id: organizationId },
    });
    if (!deal) throw AppError.notFound('Deal not found');

    // Generate unique tracking code with retry
    let attempts = 0;
    while (attempts < 3) {
      const trackingCode = generateTrackingCode();
      try {
        const link = await prisma.trackedLink.create({
          data: {
            organization_id: organizationId,
            deal_id: input.deal_id,
            created_by_id: userId,
            original_url: input.original_url,
            tracking_code: trackingCode,
            label: input.label || null,
            expires_at: input.expires_at ? new Date(input.expires_at) : null,
            metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null,
          },
          include: {
            deal: { select: { id: true, title: true, deal_number: true } },
          },
        });

        // Log activity on deal
        await prisma.dealActivity.create({
          data: {
            deal_id: input.deal_id,
            user_id: userId,
            type: 'LINK_CREATED',
            title: `Tracked link created: ${input.label || trackingCode}`,
            metadata: JSON.parse(JSON.stringify({ tracking_code: trackingCode, original_url: input.original_url })),
          },
        });

        return link;
      } catch (err: any) {
        if (err.code === 'P2002' && attempts < 2) {
          attempts++;
          continue;
        }
        throw err;
      }
    }
    throw AppError.badRequest('Failed to generate unique tracking code');
  }

  async update(organizationId: string, id: string, input: UpdateTrackedLinkInput) {
    await this.getById(organizationId, id);

    const updateData: any = {};
    if (input.label !== undefined) updateData.label = input.label;
    if (input.expires_at !== undefined) updateData.expires_at = input.expires_at ? new Date(input.expires_at) : null;
    if (input.metadata !== undefined) updateData.metadata = JSON.parse(JSON.stringify(input.metadata));

    return prisma.trackedLink.update({
      where: { id },
      data: updateData,
      include: {
        deal: { select: { id: true, title: true, deal_number: true } },
      },
    });
  }

  async delete(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    await prisma.trackedLink.delete({ where: { id } });
  }

  /** Called from public redirect route — no auth required */
  async recordClick(trackingCode: string) {
    const link = await prisma.trackedLink.findUnique({
      where: { tracking_code: trackingCode },
    });
    if (!link) return null;

    // Check expiry
    if (link.expires_at && link.expires_at < new Date()) {
      return null;
    }

    // Increment click count
    await prisma.trackedLink.update({
      where: { id: link.id },
      data: { click_count: { increment: 1 } },
    });

    // Log click activity on deal
    await prisma.dealActivity.create({
      data: {
        deal_id: link.deal_id,
        type: 'LINK_CLICKED',
        title: `Link clicked: ${link.label || link.tracking_code}`,
        metadata: JSON.parse(JSON.stringify({ tracking_code: link.tracking_code, click_count: link.click_count + 1 })),
      },
    });

    return link.original_url;
  }
}

export const trackedLinkService = new TrackedLinkService();
