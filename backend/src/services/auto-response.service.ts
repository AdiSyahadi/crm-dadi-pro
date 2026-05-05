import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { AutoResponseTrigger } from '@prisma/client';

export interface UpsertAutoResponseInput {
  trigger: AutoResponseTrigger;
  template_id: string;
  wa_instance_id?: string | null;
  business_hour_start?: string | null;
  business_hour_end?: string | null;
  business_days?: number[] | null;
  timezone?: string;
  cooldown_minutes?: number;
  is_active?: boolean;
}

export class AutoResponseService {
  async list(organizationId: string) {
    return prisma.autoResponse.findMany({
      where: { organization_id: organizationId },
      include: {
        template: { select: { id: true, name: true, category: true, content: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async upsert(organizationId: string, input: UpsertAutoResponseInput) {
    // Verify template belongs to this org
    const template = await prisma.messageTemplate.findFirst({
      where: { id: input.template_id, organization_id: organizationId },
    });
    if (!template) throw AppError.notFound('Template not found');

    const instanceId = input.wa_instance_id || null;

    // Find existing rule for this org + trigger + instance
    const existing = await prisma.autoResponse.findFirst({
      where: {
        organization_id: organizationId,
        trigger: input.trigger,
        wa_instance_id: instanceId,
      },
    });

    if (existing) {
      return prisma.autoResponse.update({
        where: { id: existing.id },
        data: {
          template_id: input.template_id,
          wa_instance_id: instanceId,
          business_hour_start: input.business_hour_start ?? undefined,
          business_hour_end: input.business_hour_end ?? undefined,
          business_days: input.business_days !== undefined ? (input.business_days ? JSON.parse(JSON.stringify(input.business_days)) : null) : undefined,
          timezone: input.timezone ?? undefined,
          cooldown_minutes: input.cooldown_minutes ?? undefined,
          is_active: input.is_active ?? undefined,
        },
        include: {
          template: { select: { id: true, name: true, category: true, content: true } },
        },
      });
    }

    return prisma.autoResponse.create({
      data: {
        organization_id: organizationId,
        trigger: input.trigger,
        template_id: input.template_id,
        wa_instance_id: instanceId,
        business_hour_start: input.business_hour_start || null,
        business_hour_end: input.business_hour_end || null,
        business_days: input.business_days ? JSON.parse(JSON.stringify(input.business_days)) : null,
        timezone: input.timezone || 'Asia/Jakarta',
        cooldown_minutes: input.cooldown_minutes ?? 60,
        is_active: input.is_active ?? true,
      },
      include: {
        template: { select: { id: true, name: true, category: true, content: true } },
      },
    });
  }

  async delete(organizationId: string, trigger: AutoResponseTrigger, waInstanceId?: string | null) {
    const existing = await prisma.autoResponse.findFirst({
      where: {
        organization_id: organizationId,
        trigger,
        wa_instance_id: waInstanceId || null,
      },
    });
    if (!existing) throw AppError.notFound('Auto-response rule not found');

    await prisma.autoResponse.delete({ where: { id: existing.id } });
  }
}

export const autoResponseService = new AutoResponseService();
