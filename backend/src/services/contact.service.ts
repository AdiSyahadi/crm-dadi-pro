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

    for (const item of contacts) {
      try {
        const existing = await prisma.contact.findFirst({
          where: {
            organization_id: organizationId,
            phone_number: item.phone_number,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

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
}

export const contactService = new ContactService();
