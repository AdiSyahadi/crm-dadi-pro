import { prisma } from '../config/database';

export class ExportService {
  async exportConversations(organizationId: string, filters?: { status?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: { select: { name: true, phone_number: true } },
        assigned_to_user: { select: { name: true } },
        labels: { select: { label: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Contact Name,Phone,Status,Assigned To,Messages,Labels,Created At,Updated At\n';
    const rows = conversations.map(c => {
      return [
        c.id,
        this.escapeCsv(c.contact?.name || ''),
        this.escapeCsv(c.contact?.phone_number || ''),
        c.status,
        this.escapeCsv(c.assigned_to_user?.name || 'Unassigned'),
        c._count.messages,
        this.escapeCsv(c.labels.map((l: any) => l.label).join('; ')),
        c.created_at.toISOString(),
        c.updated_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportContacts(organizationId: string, filters?: { from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        _count: { select: { conversations: true } },
        contact_tags: { include: { tag: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Name,Phone,Email,Conversations,Tags,Created At\n';
    const rows = contacts.map(c => {
      return [
        c.id,
        this.escapeCsv(c.name || ''),
        this.escapeCsv(c.phone_number),
        this.escapeCsv(c.email || ''),
        c._count.conversations,
        this.escapeCsv(c.contact_tags.map((t: any) => t.tag.name).join('; ')),
        c.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportDeals(organizationId: string, filters?: { stage?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.stage) where.stage = filters.stage;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        contact: { select: { name: true, phone_number: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Title,Contact,Phone,Stage,Value,Currency,Expected Close,Created At\n';
    const rows = deals.map(d => {
      return [
        d.id,
        this.escapeCsv(d.title),
        this.escapeCsv(d.contact?.name || ''),
        this.escapeCsv(d.contact?.phone_number || ''),
        d.stage,
        d.value?.toString() || '0',
        d.currency || 'IDR',
        d.expected_close_date ? d.expected_close_date.toISOString().split('T')[0] : '',
        d.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  private escapeCsv(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}

export const exportService = new ExportService();
