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

  async exportTasks(organizationId: string, filters?: { status?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assigned_to: { select: { name: true } },
        created_by: { select: { name: true } },
        contact: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Title,Type,Status,Priority,Assigned To,Contact,Due Date,Created By,Created At\n';
    const rows = tasks.map(t => {
      return [
        t.id,
        this.escapeCsv(t.title),
        t.type,
        t.status,
        t.priority,
        this.escapeCsv(t.assigned_to?.name || 'Unassigned'),
        this.escapeCsv(t.contact?.name || ''),
        t.due_date ? t.due_date.toISOString().split('T')[0] : '',
        this.escapeCsv(t.created_by?.name || ''),
        t.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportReceipts(organizationId: string, filters?: { status?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const receipts = await prisma.receipt.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Receipt Number,Type,Status,Recipient,Phone,Total Amount,Currency,Payment Method,Created At\n';
    const rows = receipts.map(r => {
      return [
        r.id,
        this.escapeCsv(r.receipt_number),
        r.type,
        r.status,
        this.escapeCsv(r.recipient_name),
        this.escapeCsv(r.recipient_phone || ''),
        r.total_amount.toString(),
        r.currency,
        this.escapeCsv(r.payment_method || ''),
        r.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportBroadcasts(organizationId: string, filters?: { status?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const broadcasts = await prisma.broadcast.findMany({
      where,
      include: {
        created_by: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Name,Status,Total Recipients,Sent,Delivered,Read,Failed,Created By,Scheduled At,Created At\n';
    const rows = broadcasts.map(b => {
      return [
        b.id,
        this.escapeCsv(b.name),
        b.status,
        b.total_recipients,
        b.sent_count,
        b.delivered_count,
        b.read_count,
        b.failed_count,
        this.escapeCsv(b.created_by?.name || ''),
        b.scheduled_at ? b.scheduled_at.toISOString() : '',
        b.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportTemplates(organizationId: string) {
    const templates = await prisma.messageTemplate.findMany({
      where: { organization_id: organizationId },
      include: {
        created_by: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Name,Category,Content,Active,Usage Count,Created By,Created At\n';
    const rows = templates.map(t => {
      return [
        t.id,
        this.escapeCsv(t.name),
        this.escapeCsv(t.category || ''),
        this.escapeCsv(t.content),
        t.is_active ? 'Yes' : 'No',
        t.usage_count,
        this.escapeCsv(t.created_by?.name || ''),
        t.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportActivityLogs(organizationId: string, filters?: { entity_type?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.entity_type) where.entity_type = filters.entity_type;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to);
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Action,Entity Type,Entity ID,User,IP Address,Created At\n';
    const rows = logs.map(l => {
      return [
        l.id,
        this.escapeCsv(l.action),
        this.escapeCsv(l.entity_type),
        l.entity_id || '',
        this.escapeCsv(l.user?.name || ''),
        this.escapeCsv(l.ip_address || ''),
        l.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportScheduledMessages(organizationId: string) {
    const messages = await prisma.scheduledMessage.findMany({
      where: { organization_id: organizationId },
      include: {
        instance: { select: { name: true } },
        created_by: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    const header = 'ID,Name,Cron,Timezone,Active,Total Sent,Total Failed,Instance,Created By,Last Executed,Created At\n';
    const rows = messages.map(m => {
      return [
        m.id,
        this.escapeCsv(m.name),
        this.escapeCsv(m.cron_expression),
        m.timezone,
        m.is_active ? 'Yes' : 'No',
        m.total_sent,
        m.total_failed,
        this.escapeCsv(m.instance?.name || ''),
        this.escapeCsv(m.created_by?.name || ''),
        m.last_executed_at ? m.last_executed_at.toISOString() : '',
        m.created_at.toISOString(),
      ].join(',');
    }).join('\n');

    return header + rows;
  }

  async exportAppointments(organizationId: string, filters?: { status?: string; from?: string; to?: string }) {
    const where: any = { organization_id: organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.start_time = {};
      if (filters.from) where.start_time.gte = new Date(filters.from);
      if (filters.to) where.start_time.lte = new Date(filters.to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        contact: { select: { name: true, phone_number: true } },
        assigned_to: { select: { name: true } },
        created_by: { select: { name: true } },
      },
      orderBy: { start_time: 'asc' },
      take: 10000,
    });

    const header = 'ID,Title,Contact,Phone,Location,Start Time,End Time,Status,Assigned To,Created By,Notes,Created At\n';
    const rows = appointments.map(a => {
      return [
        a.id,
        this.escapeCsv(a.title),
        this.escapeCsv(a.contact?.name || ''),
        this.escapeCsv(a.contact?.phone_number || ''),
        this.escapeCsv(a.location || ''),
        a.start_time.toISOString(),
        a.end_time.toISOString(),
        a.status,
        this.escapeCsv(a.assigned_to?.name || ''),
        this.escapeCsv(a.created_by?.name || ''),
        this.escapeCsv(a.notes || ''),
        a.created_at.toISOString(),
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
