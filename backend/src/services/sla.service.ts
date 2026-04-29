import { prisma } from '../config/database';
import { notificationService } from './notification.service';
import { getIO } from '../socket/io';

class SlaService {
  async getSettings(organizationId: string) {
    let settings = await prisma.slaSetting.findUnique({
      where: { organization_id: organizationId },
    });
    if (!settings) {
      settings = await prisma.slaSetting.create({
        data: { organization_id: organizationId },
      });
    }
    return settings;
  }

  async updateSettings(organizationId: string, data: {
    is_enabled?: boolean;
    first_response_minutes?: number;
    resolution_minutes?: number;
    escalation_enabled?: boolean;
    warning_threshold_pct?: number;
  }) {
    return prisma.slaSetting.upsert({
      where: { organization_id: organizationId },
      create: { organization_id: organizationId, ...data },
      update: data,
    });
  }

  /**
   * Set SLA deadline on a conversation when it becomes OPEN.
   * Called from conversation service.
   */
  async setSlaDeadline(conversationId: string, organizationId: string) {
    const settings = await prisma.slaSetting.findUnique({
      where: { organization_id: organizationId },
    });
    if (!settings?.is_enabled) return;

    const deadline = new Date(Date.now() + settings.resolution_minutes * 60 * 1000);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { sla_deadline_at: deadline, sla_breached_at: null, sla_warning_sent: false },
    });
  }

  /**
   * Check all organizations for SLA breaches and warnings.
   * Called by SLA worker periodically.
   */
  async checkBreaches() {
    const now = new Date();

    // Get all orgs with SLA enabled
    const slaSettings = await prisma.slaSetting.findMany({
      where: { is_enabled: true },
      include: { organization: { select: { id: true, name: true } } },
    });

    for (const settings of slaSettings) {
      await this.checkOrgBreaches(settings, now);
    }
  }

  private async checkOrgBreaches(settings: any, now: Date) {
    const orgId = settings.organization_id;

    // Find conversations with SLA deadline that haven't been breached yet
    const atRiskConversations = await prisma.conversation.findMany({
      where: {
        organization_id: orgId,
        status: 'OPEN',
        sla_deadline_at: { not: null },
        sla_breached_at: null,
      },
      include: {
        contact: { select: { name: true, phone_number: true } },
        assigned_to_user: { select: { id: true, name: true } },
      },
    });

    // Get supervisors/admins/owners for escalation notifications
    const managers = await prisma.user.findMany({
      where: {
        organization_id: orgId,
        role: { in: ['OWNER', 'ADMIN', 'SUPERVISOR'] },
        is_active: true,
      },
      select: { id: true, role: true },
    });

    for (const conv of atRiskConversations) {
      if (!conv.sla_deadline_at) continue;
      const deadline = conv.sla_deadline_at.getTime();
      const remaining = deadline - now.getTime();
      const totalSla = settings.resolution_minutes * 60 * 1000;
      const warningThreshold = totalSla * (1 - settings.warning_threshold_pct / 100);

      // Check if breached
      if (remaining <= 0) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { sla_breached_at: now },
        });

        const contactName = conv.contact?.name || conv.contact?.phone_number || 'Unknown';

        // Notify assigned agent
        if (conv.assigned_to_user) {
          await notificationService.create(
            conv.assigned_to_user.id,
            'SLA_BREACHED',
            'SLA Terlewati!',
            `Percakapan dengan ${contactName} telah melewati batas SLA`,
            { conversation_id: conv.id }
          ).catch(() => {});
        }

        // Escalate to managers
        if (settings.escalation_enabled) {
          for (const mgr of managers) {
            await notificationService.create(
              mgr.id,
              'SLA_BREACHED',
              'Eskalasi SLA',
              `Percakapan dengan ${contactName} melewati SLA${conv.assigned_to_user ? ` (ditugaskan ke ${conv.assigned_to_user.name})` : ' (belum ditugaskan)'}`,
              { conversation_id: conv.id }
            ).catch(() => {});
          }
        }

        // Emit realtime event
        const io = getIO();
        if (io) {
          io.to(`org:${orgId}`).emit('sla:breached', {
            conversationId: conv.id,
            contactName,
            assignedTo: conv.assigned_to_user?.name || null,
          });
        }
      }
      // Check if warning needed
      else if (remaining <= warningThreshold && !conv.sla_warning_sent) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { sla_warning_sent: true },
        });

        const contactName = conv.contact?.name || conv.contact?.phone_number || 'Unknown';

        // Notify assigned agent
        if (conv.assigned_to_user) {
          await notificationService.create(
            conv.assigned_to_user.id,
            'SLA_WARNING',
            'Peringatan SLA',
            `Percakapan dengan ${contactName} mendekati batas SLA (sisa ${Math.ceil(remaining / 60000)} menit)`,
            { conversation_id: conv.id }
          ).catch(() => {});
        }
      }
    }
  }

  /**
   * Get SLA stats for analytics
   */
  async getStats(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, breached, withinSla] = await Promise.all([
      prisma.conversation.count({
        where: {
          organization_id: organizationId,
          sla_deadline_at: { not: null },
          created_at: { gte: since },
        },
      }),
      prisma.conversation.count({
        where: {
          organization_id: organizationId,
          sla_breached_at: { not: null },
          created_at: { gte: since },
        },
      }),
      prisma.conversation.count({
        where: {
          organization_id: organizationId,
          sla_deadline_at: { not: null },
          sla_breached_at: null,
          status: 'RESOLVED',
          created_at: { gte: since },
        },
      }),
    ]);

    return {
      total,
      breached,
      within_sla: withinSla,
      compliance_rate: total > 0 ? Math.round((withinSla / total) * 100) : 100,
    };
  }

  async listBreached(organizationId: string, page = 1, limit = 20) {
    const where = {
      organization_id: organizationId,
      sla_breached_at: { not: null } as { not: null },
    };
    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { sla_breached_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          sla_deadline_at: true,
          sla_breached_at: true,
          created_at: true,
          contact: { select: { id: true, name: true, phone_number: true } },
          assigned_to_user: { select: { id: true, name: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);
    return { rows, total, page, limit };
  }
}

export const slaService = new SlaService();
