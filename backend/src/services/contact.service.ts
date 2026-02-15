import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateContactInput, UpdateContactInput, ListContactsInput } from '../validators/contact.validator';

export class ContactService {
  async list(organizationId: string, input: ListContactsInput) {
    const { page, limit, search, stage, source, tag, sort_by, sort_order } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };

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

  async getById(organizationId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organization_id: organizationId },
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

    return this.getById(organizationId, contact.id);
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

    return this.getById(organizationId, contactId);
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
}

export const contactService = new ContactService();
