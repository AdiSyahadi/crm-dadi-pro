import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { WAApiClient } from './wa-api.client';
import { Queue } from 'bullmq';
import { redis } from '../config/redis';

const scheduledQueue = new Queue('scheduled-messages', { connection: redis });

export interface CreateScheduledMessageInput {
  name: string;
  instance_id: string;
  message_content: string;
  media_url?: string;
  media_type?: string;
  cron_expression: string;
  timezone?: string;
  skip_days?: number[];
  recipient_tag_ids?: string[];
  recipient_contact_ids?: string[];
  delay_min_seconds?: number;
  delay_max_seconds?: number;
}

export interface UpdateScheduledMessageInput {
  name?: string;
  instance_id?: string;
  message_content?: string;
  media_url?: string | null;
  media_type?: string | null;
  cron_expression?: string;
  timezone?: string;
  skip_days?: number[] | null;
  recipient_tag_ids?: string[] | null;
  delay_min_seconds?: number;
  delay_max_seconds?: number;
}

export class ScheduledMessageService {
  async list(organizationId: string) {
    const schedules = await prisma.scheduledMessage.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: {
        instance: { select: { id: true, name: true, phone_number: true } },
        created_by: { select: { id: true, name: true } },
        _count: { select: { recipients: true, logs: true } },
      },
    });
    return schedules;
  }

  async getById(organizationId: string, id: string) {
    const schedule = await prisma.scheduledMessage.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        instance: { select: { id: true, name: true, phone_number: true, wa_instance_id: true } },
        created_by: { select: { id: true, name: true } },
        recipients: {
          include: { contact: { select: { id: true, name: true, phone_number: true } } },
          orderBy: { added_at: 'desc' },
        },
        logs: { orderBy: { executed_at: 'desc' }, take: 20 },
      },
    });
    if (!schedule) throw AppError.notFound('Jadwal pesan tidak ditemukan');
    return schedule;
  }

  async create(organizationId: string, userId: string, input: CreateScheduledMessageInput) {
    // Verify instance
    const instance = await prisma.wAInstance.findFirst({
      where: { id: input.instance_id, organization_id: organizationId },
    });
    if (!instance) throw AppError.notFound('WA Instance not found');

    // Validate recipient_tag_ids if provided
    if (input.recipient_tag_ids && input.recipient_tag_ids.length > 0) {
      const tagCount = await prisma.tag.count({
        where: { id: { in: input.recipient_tag_ids }, organization_id: organizationId },
      });
      if (tagCount !== input.recipient_tag_ids.length) {
        throw AppError.badRequest('Satu atau lebih tag tidak ditemukan');
      }
    }

    // Get contacts for manual recipients
    let contacts: { id: string; phone_number: string }[] = [];
    if (input.recipient_contact_ids && input.recipient_contact_ids.length > 0) {
      contacts = await prisma.contact.findMany({
        where: {
          id: { in: input.recipient_contact_ids },
          organization_id: organizationId,
          is_blocked: false,
          phone_number: { not: '' },
        },
        select: { id: true, phone_number: true },
      });
    }

    // Must have at least manual recipients OR tag-based recipients
    if (contacts.length === 0 && (!input.recipient_tag_ids || input.recipient_tag_ids.length === 0)) {
      throw AppError.badRequest('Harus ada minimal 1 penerima (kontak atau tag)');
    }

    const schedule = await prisma.scheduledMessage.create({
      data: {
        organization_id: organizationId,
        instance_id: input.instance_id,
        name: input.name,
        message_content: input.message_content,
        media_url: input.media_url || null,
        media_type: (input.media_type?.toUpperCase() as any) || null,
        cron_expression: input.cron_expression,
        timezone: input.timezone || 'Asia/Jakarta',
        skip_days: input.skip_days || Prisma.JsonNull,
        recipient_tag_ids: input.recipient_tag_ids || Prisma.JsonNull,
        delay_min_seconds: input.delay_min_seconds ?? 3,
        delay_max_seconds: input.delay_max_seconds ?? 10,
        is_active: true,
        created_by_id: userId,
      },
    });

    // Create manual recipients
    if (contacts.length > 0) {
      await prisma.scheduledMessageRecipient.createMany({
        data: contacts.map((c) => ({
          scheduled_message_id: schedule.id,
          contact_id: c.id,
          phone_number: c.phone_number,
        })),
      });
    }

    // Register BullMQ repeatable job
    await this.registerJob(schedule.id, input.cron_expression, input.timezone || 'Asia/Jakarta');

    return this.getById(organizationId, schedule.id);
  }

  async update(organizationId: string, id: string, input: UpdateScheduledMessageInput) {
    const existing = await this.getById(organizationId, id);

    if (input.instance_id) {
      const instance = await prisma.wAInstance.findFirst({
        where: { id: input.instance_id, organization_id: organizationId },
      });
      if (!instance) throw AppError.notFound('WA Instance not found');
    }

    if (input.recipient_tag_ids && input.recipient_tag_ids.length > 0) {
      const tagCount = await prisma.tag.count({
        where: { id: { in: input.recipient_tag_ids }, organization_id: organizationId },
      });
      if (tagCount !== input.recipient_tag_ids.length) {
        throw AppError.badRequest('Satu atau lebih tag tidak ditemukan');
      }
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.instance_id !== undefined) data.instance_id = input.instance_id;
    if (input.message_content !== undefined) data.message_content = input.message_content;
    if (input.media_url !== undefined) data.media_url = input.media_url;
    if (input.media_type !== undefined) data.media_type = input.media_type ? (input.media_type.toUpperCase() as any) : null;
    if (input.cron_expression !== undefined) data.cron_expression = input.cron_expression;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.skip_days !== undefined) data.skip_days = input.skip_days;
    if (input.recipient_tag_ids !== undefined) data.recipient_tag_ids = input.recipient_tag_ids;
    if (input.delay_min_seconds !== undefined) data.delay_min_seconds = input.delay_min_seconds;
    if (input.delay_max_seconds !== undefined) data.delay_max_seconds = input.delay_max_seconds;

    await prisma.scheduledMessage.update({ where: { id }, data });

    // Re-register job if cron or timezone changed
    if (input.cron_expression !== undefined || input.timezone !== undefined) {
      await this.removeJob(existing.bullmq_job_key);
      const cron = input.cron_expression || existing.cron_expression;
      const tz = input.timezone || existing.timezone;
      if (existing.is_active) {
        await this.registerJob(id, cron, tz);
      }
    }

    return this.getById(organizationId, id);
  }

  async addRecipients(organizationId: string, id: string, contactIds: string[]) {
    await this.getById(organizationId, id);

    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        organization_id: organizationId,
        is_blocked: false,
        phone_number: { not: '' },
      },
      select: { id: true, phone_number: true },
    });

    if (contacts.length === 0) throw AppError.badRequest('Tidak ada kontak valid');

    // Upsert to avoid duplicates
    for (const c of contacts) {
      await prisma.scheduledMessageRecipient.upsert({
        where: {
          scheduled_message_id_contact_id: {
            scheduled_message_id: id,
            contact_id: c.id,
          },
        },
        create: {
          scheduled_message_id: id,
          contact_id: c.id,
          phone_number: c.phone_number,
          is_active: true,
        },
        update: { is_active: true, phone_number: c.phone_number },
      });
    }

    return this.getById(organizationId, id);
  }

  async removeRecipients(organizationId: string, id: string, contactIds: string[]) {
    await this.getById(organizationId, id);

    await prisma.scheduledMessageRecipient.deleteMany({
      where: {
        scheduled_message_id: id,
        contact_id: { in: contactIds },
      },
    });

    return this.getById(organizationId, id);
  }

  async toggle(organizationId: string, id: string) {
    const schedule = await this.getById(organizationId, id);
    const newActive = !schedule.is_active;

    await prisma.scheduledMessage.update({
      where: { id },
      data: { is_active: newActive },
    });

    if (newActive) {
      await this.registerJob(id, schedule.cron_expression, schedule.timezone);
    } else {
      await this.removeJob(schedule.bullmq_job_key);
      await prisma.scheduledMessage.update({
        where: { id },
        data: { bullmq_job_key: null },
      });
    }

    return this.getById(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    const schedule = await this.getById(organizationId, id);
    await this.removeJob(schedule.bullmq_job_key);
    await prisma.scheduledMessage.delete({ where: { id } });
  }

  async getLogs(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.scheduledMessageLog.findMany({
      where: { scheduled_message_id: id },
      orderBy: { executed_at: 'desc' },
      take: 50,
    });
  }

  // ─── BullMQ Job Management ───

  private async registerJob(scheduleId: string, cron: string, timezone: string) {
    const job = await scheduledQueue.add(
      'send-scheduled',
      { scheduleId },
      {
        repeat: { pattern: cron, tz: timezone },
        jobId: `sched-${scheduleId}`,
      }
    );

    const jobKey = `sched-${scheduleId}`;
    await prisma.scheduledMessage.update({
      where: { id: scheduleId },
      data: { bullmq_job_key: jobKey },
    });

    return jobKey;
  }

  private async removeJob(jobKey: string | null) {
    if (!jobKey) return;
    try {
      await scheduledQueue.removeRepeatableByKey(jobKey);
    } catch {
      // Job may already be removed
    }
  }

  // ─── Execution (called by worker) ───

  async executeSchedule(scheduleId: string) {
    const schedule = await prisma.scheduledMessage.findUnique({
      where: { id: scheduleId },
      include: {
        instance: true,
        recipients: {
          where: { is_active: true },
          include: { contact: { select: { id: true, name: true, phone_number: true } } },
        },
      },
    });

    if (!schedule || !schedule.is_active) return;

    // Conditional skip: check day of week
    const now = new Date();
    const dayOfWeek = parseInt(
      new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: schedule.timezone })
        .formatToParts(now)
        .find((p) => p.type === 'weekday')?.value || '0'
    );
    // Convert: Sun=0, Mon=1, ..., Sat=6
    const dayMap: Record<string, number> = { S: 0, M: 1, T: 2, W: 3, R: 4, F: 5, A: 6 };
    // Better approach: use getDay equivalent in timezone
    const tzDay = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone })).getDay();

    if (schedule.skip_days) {
      const skipDays = schedule.skip_days as number[];
      if (Array.isArray(skipDays) && skipDays.includes(tzDay)) {
        await prisma.scheduledMessageLog.create({
          data: {
            scheduled_message_id: scheduleId,
            total_targets: 0,
            sent_count: 0,
            failed_count: 0,
            skipped_reason: `Hari ini (${tzDay}) ada di daftar skip`,
          },
        });
        return;
      }
    }

    // Collect recipients: manual + tag-based
    const manualPhones = new Map<string, { name: string | null; phone: string }>();
    for (const r of schedule.recipients) {
      if (r.contact.phone_number) {
        manualPhones.set(r.contact.phone_number, {
          name: r.contact.name,
          phone: r.contact.phone_number,
        });
      }
    }

    // Auto-add by tag
    if (schedule.recipient_tag_ids) {
      const tagIds = schedule.recipient_tag_ids as string[];
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        const tagContacts = await prisma.contact.findMany({
          where: {
            organization_id: schedule.organization_id,
            is_blocked: false,
            is_subscribed: true,
            phone_number: { not: '' },
            contact_tags: { some: { tag_id: { in: tagIds } } },
          },
          select: { name: true, phone_number: true },
        });
        for (const c of tagContacts) {
          if (!manualPhones.has(c.phone_number)) {
            manualPhones.set(c.phone_number, { name: c.name, phone: c.phone_number });
          }
        }
      }
    }

    const allRecipients = Array.from(manualPhones.values());
    if (allRecipients.length === 0) {
      await prisma.scheduledMessageLog.create({
        data: {
          scheduled_message_id: scheduleId,
          total_targets: 0,
          sent_count: 0,
          failed_count: 0,
          skipped_reason: 'Tidak ada penerima',
        },
      });
      return;
    }

    // Init WA client
    let waClient: WAApiClient;
    try {
      waClient = await WAApiClient.forOrganization(schedule.organization_id);
    } catch (err: any) {
      await prisma.scheduledMessageLog.create({
        data: {
          scheduled_message_id: scheduleId,
          total_targets: allRecipients.length,
          sent_count: 0,
          failed_count: allRecipients.length,
          skipped_reason: `WA API error: ${err.message}`,
        },
      });
      return;
    }

    let sentCount = 0;
    let failedCount = 0;
    const details: any[] = [];

    for (const recipient of allRecipients) {
      // Template variable replacement
      let messageContent = schedule.message_content;
      messageContent = messageContent.replace(/\{nama\}/gi, recipient.name || recipient.phone);
      messageContent = messageContent.replace(/\{phone\}/gi, recipient.phone);
      messageContent = messageContent.replace(/\{tanggal\}/gi, now.toLocaleDateString('id-ID', { timeZone: schedule.timezone }));
      messageContent = messageContent.replace(/\{hari\}/gi, now.toLocaleDateString('id-ID', { weekday: 'long', timeZone: schedule.timezone }));

      try {
        if (schedule.media_url) {
          await waClient.sendMedia(
            schedule.instance.wa_instance_id,
            recipient.phone,
            messageContent,
            schedule.media_url,
            schedule.media_type || 'image'
          );
        } else {
          await waClient.sendText(
            schedule.instance.wa_instance_id,
            recipient.phone,
            messageContent
          );
        }
        sentCount++;
        details.push({ phone: recipient.phone, status: 'sent' });
      } catch (error: any) {
        failedCount++;
        const errMsg = error.response?.data?.error || error.message || 'Unknown error';
        details.push({ phone: recipient.phone, status: 'failed', error: typeof errMsg === 'string' ? errMsg : String(errMsg) });
        console.error(`⏰ Scheduled send failed to ${recipient.phone}:`, errMsg);

        // Fatal: instance disconnected or daily limit → stop
        const errStr = typeof errMsg === 'string' ? errMsg : String(errMsg);
        if (errStr.includes('not connected') || errStr.includes('Daily message limit')) {
          // Log remaining as failed
          failedCount += allRecipients.length - sentCount - failedCount;
          break;
        }
      }

      // Random delay
      const delay = Math.random() * (schedule.delay_max_seconds - schedule.delay_min_seconds) + schedule.delay_min_seconds;
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }

    // Save log
    await prisma.scheduledMessageLog.create({
      data: {
        scheduled_message_id: scheduleId,
        total_targets: allRecipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        details,
      },
    });

    // Update stats
    await prisma.scheduledMessage.update({
      where: { id: scheduleId },
      data: {
        total_sent: { increment: sentCount },
        total_failed: { increment: failedCount },
        last_executed_at: now,
      },
    });
  }
}

export const scheduledMessageService = new ScheduledMessageService();
