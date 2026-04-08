import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateContactInput, UpdateContactInput, ListContactsInput } from '../validators/contact.validator';
import { dispatchWebhookEvent } from './webhook-dispatcher.service';

export class ContactService {
  async list(organizationId: string, input: ListContactsInput, assignedToUserId?: string) {
    const { page, limit, search, stage, source, tag, sort_by, sort_order } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };

    // AGENT isolation: only show contacts that have at least one conversation assigned to this agent
    if (assignedToUserId) {
      where.conversations = {
        some: { assigned_to_user_id: assignedToUserId },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone_number: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ];
    }

    if (stage) where.stage = stage;
    if (source) where.source = source;

    if (tag) {
      where.contact_tags = {
        some: { tag: { name: tag } },
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          contact_tags: {
            include: { tag: { select: { id: true, name: true, color: true } } },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map((c) => ({
        ...c,
        tags: c.contact_tags.map((ct) => ct.tag),
        contact_tags: undefined,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(organizationId: string, contactId: string, assignedToUserId?: string) {
    const where: any = { id: contactId, organization_id: organizationId };

    // AGENT isolation: only allow access to contacts with assigned conversations
    if (assignedToUserId) {
      where.conversations = {
        some: { assigned_to_user_id: assignedToUserId },
      };
    }

    const contact = await prisma.contact.findFirst({
      where,
      include: {
        contact_tags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
        conversations: {
          select: {
            id: true,
            chat_jid: true,
            status: true,
            last_message_at: true,
            last_message_preview: true,
            unread_count: true,
          },
          orderBy: { last_message_at: 'desc' },
          take: 5,
        },
        deals: {
          select: {
            id: true,
            title: true,
            stage: true,
            value: true,
            closed_status: true,
          },
          orderBy: { created_at: 'desc' },
          take: 5,
        },
      },
    });

    if (!contact) {
      throw AppError.notFound('Contact not found');
    }

    return {
      ...contact,
      tags: contact.contact_tags.map((ct) => ct.tag),
      contact_tags: undefined,
    };
  }

  async create(organizationId: string, input: CreateContactInput) {
    // Check duplicate phone
    const existing = await prisma.contact.findFirst({
      where: {
        organization_id: organizationId,
        phone_number: input.phone_number,
      },
    });

    if (existing) {
      throw AppError.conflict('Contact with this phone number already exists');
    }

    const { tags, custom_fields, ...contactData } = input;

    const contact = await prisma.contact.create({
      data: {
        organization_id: organizationId,
        ...contactData,
        custom_fields: custom_fields ? JSON.parse(JSON.stringify(custom_fields)) : undefined,
      },
    });

    // Assign tags if provided
    if (tags && tags.length > 0) {
      await this.assignTags(organizationId, contact.id, tags);
    }

    const fullContact = await this.getById(organizationId, contact.id);
    dispatchWebhookEvent(organizationId, 'contact.created', { contact: fullContact });
    return fullContact;
  }

  async update(organizationId: string, contactId: string, input: UpdateContactInput) {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!existing) {
      throw AppError.notFound('Contact not found');
    }

    // Check duplicate phone if phone is being changed
    if (input.phone_number && input.phone_number !== existing.phone_number) {
      const duplicate = await prisma.contact.findFirst({
        where: {
          organization_id: organizationId,
          phone_number: input.phone_number,
          id: { not: contactId },
        },
      });
      if (duplicate) {
        throw AppError.conflict('Contact with this phone number already exists');
      }
    }

    const { tags, custom_fields, ...contactData } = input;

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...contactData,
        custom_fields: custom_fields ? JSON.parse(JSON.stringify(custom_fields)) : undefined,
      },
    });

    // Update tags if provided
    if (tags !== undefined) {
      await prisma.contactTag.deleteMany({ where: { contact_id: contactId } });
      if (tags.length > 0) {
        await this.assignTags(organizationId, contactId, tags);
      }
    }

    const updatedContact = await this.getById(organizationId, contactId);
    dispatchWebhookEvent(organizationId, 'contact.updated', { contact: updatedContact });
    return updatedContact;
  }

  async delete(organizationId: string, contactId: string) {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!existing) {
      throw AppError.notFound('Contact not found');
    }

    await prisma.contact.delete({ where: { id: contactId } });
  }

  async importContacts(organizationId: string, contacts: Array<{ phone_number: string; name?: string; email?: string; company?: string; tags?: string[] }>) {
    let created = 0;
    let skipped = 0;
    const errors: Array<{ phone_number: string; reason: string }> = [];

    // Batch existence check: fetch all existing phone numbers in one query
    const allPhones = contacts.map(c => c.phone_number);
    const existingContacts = await prisma.contact.findMany({
      where: { organization_id: organizationId, phone_number: { in: allPhones } },
      select: { phone_number: true },
    });
    const existingPhones = new Set(existingContacts.map(c => c.phone_number));

    // Separate new vs existing
    const toCreate: typeof contacts = [];
    for (const item of contacts) {
      if (existingPhones.has(item.phone_number)) {
        skipped++;
      } else {
        toCreate.push(item);
      }
    }

    // Batch create contacts without tags first
    const contactsWithoutTags = toCreate.filter(c => !c.tags || c.tags.length === 0);
    const contactsWithTags = toCreate.filter(c => c.tags && c.tags.length > 0);

    if (contactsWithoutTags.length > 0) {
      try {
        const result = await prisma.contact.createMany({
          data: contactsWithoutTags.map(item => ({
            organization_id: organizationId,
            phone_number: item.phone_number,
            name: item.name,
            email: item.email,
            company: item.company,
            source: 'IMPORT' as const,
          })),
          skipDuplicates: true,
        });
        created += result.count;
      } catch (err: any) {
        // Fallback: if batch fails, log but don't lose data silently
        for (const item of contactsWithoutTags) {
          errors.push({ phone_number: item.phone_number, reason: err.message });
        }
      }
    }

    // Contacts with tags need individual create for tag assignment
    for (const item of contactsWithTags) {
      try {
        const contact = await prisma.contact.create({
          data: {
            organization_id: organizationId,
            phone_number: item.phone_number,
            name: item.name,
            email: item.email,
            company: item.company,
            source: 'IMPORT',
          },
        });

        if (item.tags && item.tags.length > 0) {
          await this.assignTags(organizationId, contact.id, item.tags);
        }

        created++;
      } catch (err: any) {
        errors.push({ phone_number: item.phone_number, reason: err.message });
      }
    }

    return { created, skipped, errors, total: contacts.length };
  }

  async bulkAssignTags(organizationId: string, contactIds: string[], tagNames: string[]) {
    // Verify all contacts belong to this org
    const count = await prisma.contact.count({
      where: { id: { in: contactIds }, organization_id: organizationId },
    });
    if (count !== contactIds.length) {
      throw AppError.badRequest('Satu atau lebih kontak tidak ditemukan');
    }

    let assigned = 0;
    for (const contactId of contactIds) {
      await this.assignTags(organizationId, contactId, tagNames);
      assigned++;
    }
    return { assigned, tags: tagNames };
  }

  private async assignTags(organizationId: string, contactId: string, tagNames: string[]) {
    for (const tagName of tagNames) {
      // Find or create tag
      let tag = await prisma.tag.findFirst({
        where: { organization_id: organizationId, name: tagName },
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: { organization_id: organizationId, name: tagName },
        });
      }

      // Create contact-tag relation (ignore if exists)
      try {
        await prisma.contactTag.create({
          data: { contact_id: contactId, tag_id: tag.id },
        });
      } catch {
        // Duplicate, ignore
      }
    }
  }
  async listTags(organizationId: string) {
    return prisma.tag.findMany({
      where: { organization_id: organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true, description: true, _count: { select: { contact_tags: true } } },
    });
  }

  async createTag(organizationId: string, input: { name: string; color?: string; description?: string }) {
    const existing = await prisma.tag.findFirst({
      where: { organization_id: organizationId, name: input.name },
    });
    if (existing) {
      throw AppError.conflict('Label dengan nama ini sudah ada');
    }
    return prisma.tag.create({
      data: {
        organization_id: organizationId,
        name: input.name,
        color: input.color || null,
        description: input.description || null,
      },
    });
  }

  async updateTag(organizationId: string, tagId: string, input: { name?: string; color?: string; description?: string }) {
    const tag = await prisma.tag.findFirst({ where: { id: tagId, organization_id: organizationId } });
    if (!tag) throw AppError.notFound('Label tidak ditemukan');

    if (input.name && input.name !== tag.name) {
      const dup = await prisma.tag.findFirst({
        where: { organization_id: organizationId, name: input.name, id: { not: tagId } },
      });
      if (dup) throw AppError.conflict('Label dengan nama ini sudah ada');
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color || null }),
        ...(input.description !== undefined && { description: input.description || null }),
      },
    });
  }

  async deleteTag(organizationId: string, tagId: string) {
    const tag = await prisma.tag.findFirst({ where: { id: tagId, organization_id: organizationId } });
    if (!tag) throw AppError.notFound('Label tidak ditemukan');
    await prisma.tag.delete({ where: { id: tagId } });
  }

  async listNotes(organizationId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, organization_id: organizationId } });
    if (!contact) throw AppError.notFound('Kontak tidak ditemukan');
    return prisma.contactNote.findMany({
      where: { contact_id: contactId },
      include: { user: { select: { id: true, name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async createNote(organizationId: string, contactId: string, userId: string, content: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, organization_id: organizationId } });
    if (!contact) throw AppError.notFound('Kontak tidak ditemukan');
    return prisma.contactNote.create({
      data: { contact_id: contactId, user_id: userId, content },
      include: { user: { select: { id: true, name: true, avatar_url: true } } },
    });
  }

  async deleteNote(organizationId: string, contactId: string, noteId: string, userId: string, role: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, organization_id: organizationId } });
    if (!contact) throw AppError.notFound('Kontak tidak ditemukan');
    const note = await prisma.contactNote.findFirst({ where: { id: noteId, contact_id: contactId } });
    if (!note) throw AppError.notFound('Catatan tidak ditemukan');
    if (note.user_id !== userId && role !== 'OWNER' && role !== 'ADMIN') {
      throw AppError.forbidden('Anda hanya bisa menghapus catatan sendiri');
    }
    await prisma.contactNote.delete({ where: { id: noteId } });
  }

  async exportCsv(organizationId: string, assignedToUserId?: string): Promise<string> {
    const where: any = { organization_id: organizationId };
    if (assignedToUserId) {
      where.conversations = { some: { assigned_to_user_id: assignedToUserId } };
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        contact_tags: { include: { tag: { select: { name: true } } } },
      },
    });

    const headers = ['name', 'phone_number', 'email', 'company', 'job_title', 'city', 'source', 'stage', 'tags', 'created_at'];
    const escapeCsvField = (val: string | null | undefined): string => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const rows = contacts.map((c) => [
      escapeCsvField(c.name),
      escapeCsvField(c.phone_number),
      escapeCsvField(c.email),
      escapeCsvField(c.company),
      escapeCsvField(c.job_title),
      escapeCsvField(c.city),
      escapeCsvField(c.source),
      escapeCsvField(c.stage),
      escapeCsvField(c.contact_tags.map((ct) => ct.tag.name).join('; ')),
      escapeCsvField(c.created_at.toISOString()),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  async merge(organizationId: string, targetId: string, sourceId: string) {
    if (targetId === sourceId) throw AppError.badRequest('Tidak bisa merge kontak yang sama');

    const [target, source] = await Promise.all([
      this.getById(organizationId, targetId),
      this.getById(organizationId, sourceId),
    ]);

    await prisma.$transaction(async (tx) => {
      // 1. Move conversations from source to target
      await tx.conversation.updateMany({
        where: { contact_id: sourceId, organization_id: organizationId },
        data: { contact_id: targetId },
      });

      // 2. Move deals from source to target
      await tx.deal.updateMany({
        where: { contact_id: sourceId, organization_id: organizationId },
        data: { contact_id: targetId },
      });

      // 3. Move notes from source to target
      await tx.contactNote.updateMany({
        where: { contact_id: sourceId },
        data: { contact_id: targetId },
      });

      // 4. Move tags (skip duplicates)
      const sourceTags = await tx.contactTag.findMany({ where: { contact_id: sourceId } });
      const targetTags = await tx.contactTag.findMany({ where: { contact_id: targetId } });
      const existingTagIds = new Set(targetTags.map((t) => t.tag_id));

      for (const st of sourceTags) {
        if (!existingTagIds.has(st.tag_id)) {
          await tx.contactTag.create({ data: { contact_id: targetId, tag_id: st.tag_id } });
        }
      }
      await tx.contactTag.deleteMany({ where: { contact_id: sourceId } });

      // 5. Move broadcast recipients
      await tx.broadcastRecipient.updateMany({
        where: { contact_id: sourceId },
        data: { contact_id: targetId },
      });

      // 6. Move scheduled message recipients (skip duplicates)
      const sourceRecipients = await tx.scheduledMessageRecipient.findMany({ where: { contact_id: sourceId } });
      for (const sr of sourceRecipients) {
        const exists = await tx.scheduledMessageRecipient.findUnique({
          where: { scheduled_message_id_contact_id: { scheduled_message_id: sr.scheduled_message_id, contact_id: targetId } },
        });
        if (!exists) {
          await tx.scheduledMessageRecipient.update({
            where: { id: sr.id },
            data: { contact_id: targetId },
          });
        } else {
          await tx.scheduledMessageRecipient.delete({ where: { id: sr.id } });
        }
      }

      // 7. Merge contact fields: fill empty fields on target from source
      const updates: any = {};
      if (!target.email && source.email) updates.email = source.email;
      if (!target.company && source.company) updates.company = source.company;
      if (!target.job_title && source.job_title) updates.job_title = source.job_title;
      if (!target.address && source.address) updates.address = source.address;
      if (!target.city && source.city) updates.city = source.city;
      if (!target.avatar_url && source.avatar_url) updates.avatar_url = source.avatar_url;
      if (!target.notes && source.notes) updates.notes = source.notes;
      // Accumulate message counts
      updates.total_messages = (target.total_messages || 0) + (source.total_messages || 0);

      if (Object.keys(updates).length > 0) {
        await tx.contact.update({ where: { id: targetId }, data: updates });
      }

      // 8. Move tasks from source to target
      await tx.task.updateMany({
        where: { contact_id: sourceId },
        data: { contact_id: targetId },
      });

      // 9. Delete source contact
      await tx.contact.delete({ where: { id: sourceId } });
    });

    return this.getById(organizationId, targetId);
  }

  async getTimeline(organizationId: string, contactId: string, limit = 50, offset = 0) {
    await this.getById(organizationId, contactId); // validate exists

    // Fetch all timeline sources in parallel
    const [notes, deals, conversations, tags, activityLogs] = await Promise.all([
      prisma.contactNote.findMany({
        where: { contact_id: contactId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.deal.findMany({
        where: { contact_id: contactId, organization_id: organizationId },
        select: { id: true, title: true, stage: true, value: true, created_at: true, updated_at: true },
        orderBy: { created_at: 'desc' },
      }),
      prisma.conversation.findMany({
        where: { contact_id: contactId, organization_id: organizationId },
        select: {
          id: true, status: true, created_at: true, resolved_at: true,
          assigned_to_user: { select: { id: true, name: true } },
          instance: { select: { name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.contactTag.findMany({
        where: { contact_id: contactId },
        include: { tag: { select: { id: true, name: true, color: true } } },
      }),
      prisma.activityLog.findMany({
        where: { contact_id: contactId, organization_id: organizationId },
        orderBy: { created_at: 'desc' },
        take: 100,
      }),
    ]);

    // Build unified timeline entries
    const timeline: Array<{
      type: string;
      timestamp: Date;
      data: any;
    }> = [];

    for (const note of notes) {
      timeline.push({
        type: 'note',
        timestamp: note.created_at,
        data: { id: note.id, content: note.content, user: note.user },
      });
    }

    for (const deal of deals) {
      timeline.push({
        type: 'deal',
        timestamp: deal.created_at,
        data: { id: deal.id, title: deal.title, stage: deal.stage, value: Number(deal.value) },
      });
    }

    for (const conv of conversations) {
      timeline.push({
        type: 'conversation',
        timestamp: conv.created_at,
        data: {
          id: conv.id, status: conv.status,
          assigned_to: conv.assigned_to_user,
          instance: conv.instance?.name,
          message_count: conv._count.messages,
          resolved_at: conv.resolved_at,
        },
      });
    }

    for (const ct of tags) {
      timeline.push({
        type: 'tag_assigned',
        timestamp: ct.assigned_at,
        data: { tag: ct.tag },
      });
    }

    for (const log of activityLogs) {
      timeline.push({
        type: 'activity',
        timestamp: log.created_at,
        data: { action: log.action, entity_type: log.entity_type, details: log.details },
      });
    }

    // Sort by timestamp descending
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      data: timeline.slice(offset, offset + limit),
      total: timeline.length,
    };
  }

  async findDuplicates(organizationId: string) {
    // Find contacts with duplicate phone numbers (normalized) or duplicate names within same org
    const contacts = await prisma.contact.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        name: true,
        phone_number: true,
        email: true,
        avatar_url: true,
        total_messages: true,
        created_at: true,
        _count: { select: { conversations: true, deals: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const groups: Map<string, typeof contacts> = new Map();

    // Group by normalized phone (strip +, spaces, dashes)
    for (const c of contacts) {
      const normalizedPhone = c.phone_number.replace(/[\s\-\+]/g, '');
      const key = `phone:${normalizedPhone}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    // Group by exact name (case-insensitive, non-empty)
    for (const c of contacts) {
      if (!c.name || c.name.trim().length < 2) continue;
      const key = `name:${c.name.trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      // Avoid adding same contact twice if already in a phone group
      const existing = groups.get(key)!;
      if (!existing.find((e) => e.id === c.id)) {
        existing.push(c);
      }
    }

    // Filter to only groups with 2+ contacts
    const duplicates: Array<{
      match_type: string;
      match_value: string;
      contacts: typeof contacts;
    }> = [];

    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const [matchType, ...rest] = key.split(':');
      duplicates.push({
        match_type: matchType,
        match_value: rest.join(':'),
        contacts: group,
      });
    }

    return duplicates;
  }
}

export const contactService = new ContactService();
