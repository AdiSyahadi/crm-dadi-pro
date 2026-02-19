import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { WAApiClient } from './wa-api.client';
import { CreateBroadcastInput, ListBroadcastsInput } from '../validators/broadcast.validator';
import { templateService } from './template.service';
import { Queue } from 'bullmq';
import { redis } from '../config/redis';

const broadcastQueue = new Queue('broadcast', { connection: redis });

export class BroadcastService {
  async list(organizationId: string, input: ListBroadcastsInput) {
    const { page, limit, status } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (status) where.status = status;

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          instance: { select: { id: true, name: true, phone_number: true } },
          template: { select: { id: true, name: true } },
          created_by: { select: { id: true, name: true } },
          _count: { select: { recipients: true } },
        },
      }),
      prisma.broadcast.count({ where }),
    ]);

    return {
      broadcasts,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, broadcastId: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: broadcastId, organization_id: organizationId },
      include: {
        instance: { select: { id: true, name: true, phone_number: true, wa_instance_id: true } },
        template: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
        recipients: {
          include: {
            contact: { select: { id: true, name: true, phone_number: true } },
          },
          orderBy: { sent_at: 'desc' },
        },
      },
    });

    if (!broadcast) throw AppError.notFound('Broadcast not found');
    return broadcast;
  }

  async create(organizationId: string, userId: string, input: CreateBroadcastInput) {
    // Verify instance exists
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

    // Collect contact IDs: manual selection + tag-based
    const contactIdSet = new Set<string>(input.recipient_contact_ids || []);

    // Resolve contacts from tags
    if (input.recipient_tag_ids && input.recipient_tag_ids.length > 0) {
      const tagContacts = await prisma.contact.findMany({
        where: {
          organization_id: organizationId,
          is_blocked: false,
          is_subscribed: true,
          phone_number: { not: '' },
          contact_tags: { some: { tag_id: { in: input.recipient_tag_ids } } },
        },
        select: { id: true },
      });
      for (const c of tagContacts) {
        contactIdSet.add(c.id);
      }
    }

    // Get contacts with valid phone numbers
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: Array.from(contactIdSet) },
        organization_id: organizationId,
        is_subscribed: true,
        is_blocked: false,
        phone_number: { not: '' },
      },
      select: { id: true, phone_number: true },
    });

    if (contacts.length === 0) {
      throw AppError.badRequest('Tidak ada penerima dengan nomor HP valid. Pilih kontak manual atau tag yang memiliki kontak.');
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        organization_id: organizationId,
        instance_id: input.instance_id,
        template_id: input.template_id || null,
        name: input.name,
        message_content: input.message_content,
        media_url: input.media_url || null,
        media_type: (input.media_type as any) || null,
        status: input.scheduled_at ? 'SCHEDULED' : 'DRAFT',
        scheduled_at: input.scheduled_at ? new Date(input.scheduled_at) : null,
        delay_min_seconds: input.delay_min_seconds,
        delay_max_seconds: input.delay_max_seconds,
        total_recipients: contacts.length,
        created_by_id: userId,
      },
    });

    // Create recipients
    await prisma.broadcastRecipient.createMany({
      data: contacts.map((c: any) => ({
        broadcast_id: broadcast.id,
        contact_id: c.id,
        phone_number: c.phone_number,
      })),
    });

    // Increment template usage_count if template_id provided
    if (input.template_id) {
      await templateService.incrementUsage(organizationId, input.template_id).catch(() => {});
    }

    return this.getById(organizationId, broadcast.id);
  }

  async start(organizationId: string, broadcastId: string) {
    const broadcast = await this.getById(organizationId, broadcastId);

    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(broadcast.status)) {
      throw AppError.badRequest(`Cannot start broadcast with status: ${broadcast.status}`);
    }

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'SENDING', started_at: new Date() },
    });

    // Add to BullMQ queue
    await broadcastQueue.add('send-broadcast', {
      broadcastId,
      organizationId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return this.getById(organizationId, broadcastId);
  }

  async pause(organizationId: string, broadcastId: string) {
    const broadcast = await this.getById(organizationId, broadcastId);
    if (broadcast.status !== 'SENDING') {
      throw AppError.badRequest('Can only pause a sending broadcast');
    }

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'PAUSED' },
    });

    return this.getById(organizationId, broadcastId);
  }

  async cancel(organizationId: string, broadcastId: string) {
    const broadcast = await this.getById(organizationId, broadcastId);
    if (['COMPLETED', 'CANCELLED'].includes(broadcast.status)) {
      throw AppError.badRequest(`Cannot cancel broadcast with status: ${broadcast.status}`);
    }

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'CANCELLED', completed_at: new Date() },
    });

    return this.getById(organizationId, broadcastId);
  }

  async delete(organizationId: string, broadcastId: string) {
    const broadcast = await this.getById(organizationId, broadcastId);
    if (broadcast.status === 'SENDING') {
      throw AppError.badRequest('Cannot delete a sending broadcast. Pause or cancel it first.');
    }
    await prisma.broadcast.delete({ where: { id: broadcastId } });
  }

  // Called by BullMQ worker
  async processBroadcast(broadcastId: string, organizationId: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: {
        instance: true,
        recipients: {
          where: { status: 'PENDING' },
          include: { contact: true },
        },
      },
    });

    if (!broadcast || broadcast.status !== 'SENDING') return;

    let waClient: WAApiClient;
    try {
      waClient = await WAApiClient.forOrganization(organizationId);
    } catch {
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'FAILED' },
      });
      return;
    }

    for (const recipient of broadcast.recipients) {
      // Check if broadcast was paused/cancelled
      const current = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
        select: { status: true },
      });
      if (current?.status !== 'SENDING') break;

      try {
        let result;
        if (broadcast.media_url) {
          result = await waClient.sendMedia(
            broadcast.instance.wa_instance_id,
            recipient.phone_number,
            recipient.personalized_message || broadcast.message_content || '',
            broadcast.media_url,
            broadcast.media_type || 'image'
          );
        } else {
          result = await waClient.sendText(
            broadcast.instance.wa_instance_id,
            recipient.phone_number,
            recipient.personalized_message || broadcast.message_content
          );
        }

        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            wa_message_id: result?.data?.message_id || result?.message_id || null,
            sent_at: new Date(),
          },
        });

        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { sent_count: { increment: 1 } },
        });
      } catch (error: any) {
        console.error(`📤 Broadcast send failed to ${recipient.phone_number}:`, JSON.stringify(error.response?.data || error.message));
        const rawErr = error.response?.data?.error;
        const errMsg = typeof rawErr === 'string' ? rawErr : (error.message || String(rawErr || ''));
        const isDailyLimit = errMsg.includes('Daily message limit') || error.response?.data?.code === 'INSTANCE_003';
        const isDisconnected = errMsg.includes('not connected') || error.response?.data?.code === 'INSTANCE_002';

        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error_message: errMsg.slice(0, 500),
          },
        });

        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { failed_count: { increment: 1 } },
        });

        // Fatal errors: stop entire broadcast, no point continuing
        if (isDailyLimit || isDisconnected) {
          const reason = isDailyLimit ? 'Daily message limit reached' : 'Instance not connected';
          console.error(`⛔ Broadcast ${broadcastId} stopped: ${reason}`);
          await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'PAUSED' },
          });
          return; // Exit processBroadcast entirely
        }
      }

      // Random delay between messages (anti-ban)
      const delay = Math.random() * (broadcast.delay_max_seconds - broadcast.delay_min_seconds) + broadcast.delay_min_seconds;
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }

    // Mark as completed
    const finalBroadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { status: true },
    });

    if (finalBroadcast?.status === 'SENDING') {
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'COMPLETED', completed_at: new Date() },
      });
    }
  }
}

export const broadcastService = new BroadcastService();
