import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

interface CreatePlanInput {
  plan_code: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  name: string;
  description?: string;
  price: number;
  billing_cycle?: string;
  max_users: number;
  max_contacts: number;
  max_wa_instances: number;
  max_templates: number;
  max_broadcasts_per_month: number;
  max_recipients_per_broadcast: number;
  max_scheduled_messages: number;
  max_deals: number;
  max_tags: number;
  max_webhook_configs: number;
  daily_message_limit: number;
  max_import_batch_size: number;
  max_storage_mb: number;
  analytics_max_days: number;
  features: Record<string, boolean>;
  sort_order?: number;
}

type UpdatePlanInput = Partial<Omit<CreatePlanInput, 'plan_code'>>;

export class AdminPlanService {
  async list() {
    return prisma.subscriptionPlan.findMany({
      orderBy: { sort_order: 'asc' },
      include: {
        _count: {
          select: { subscribed_organizations: true, invoices: true },
        },
      },
    });
  }

  async getById(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscribed_organizations: true, invoices: true },
        },
      },
    });
    if (!plan) throw AppError.notFound('Plan tidak ditemukan');
    return plan;
  }

  async getByCode(planCode: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { plan_code: planCode as any },
    });
    if (!plan) throw AppError.notFound('Plan tidak ditemukan');
    return plan;
  }

  async create(input: CreatePlanInput) {
    // Check if plan_code already exists
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { plan_code: input.plan_code as any },
    });
    if (existing) {
      throw AppError.conflict(`Plan dengan kode ${input.plan_code} sudah ada`);
    }

    return prisma.subscriptionPlan.create({
      data: {
        plan_code: input.plan_code as any,
        name: input.name,
        description: input.description,
        price: input.price,
        billing_cycle: input.billing_cycle || 'monthly',
        max_users: input.max_users,
        max_contacts: input.max_contacts,
        max_wa_instances: input.max_wa_instances,
        max_templates: input.max_templates,
        max_broadcasts_per_month: input.max_broadcasts_per_month,
        max_recipients_per_broadcast: input.max_recipients_per_broadcast,
        max_scheduled_messages: input.max_scheduled_messages,
        max_deals: input.max_deals,
        max_tags: input.max_tags,
        max_webhook_configs: input.max_webhook_configs,
        daily_message_limit: input.daily_message_limit,
        max_import_batch_size: input.max_import_batch_size,
        max_storage_mb: input.max_storage_mb,
        analytics_max_days: input.analytics_max_days,
        features: input.features,
        sort_order: input.sort_order ?? 0,
      },
    });
  }

  async update(id: string, input: UpdatePlanInput) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Plan tidak ditemukan');

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) data.price = input.price;
    if (input.billing_cycle !== undefined) data.billing_cycle = input.billing_cycle;
    if (input.max_users !== undefined) data.max_users = input.max_users;
    if (input.max_contacts !== undefined) data.max_contacts = input.max_contacts;
    if (input.max_wa_instances !== undefined) data.max_wa_instances = input.max_wa_instances;
    if (input.max_templates !== undefined) data.max_templates = input.max_templates;
    if (input.max_broadcasts_per_month !== undefined) data.max_broadcasts_per_month = input.max_broadcasts_per_month;
    if (input.max_recipients_per_broadcast !== undefined) data.max_recipients_per_broadcast = input.max_recipients_per_broadcast;
    if (input.max_scheduled_messages !== undefined) data.max_scheduled_messages = input.max_scheduled_messages;
    if (input.max_deals !== undefined) data.max_deals = input.max_deals;
    if (input.max_tags !== undefined) data.max_tags = input.max_tags;
    if (input.max_webhook_configs !== undefined) data.max_webhook_configs = input.max_webhook_configs;
    if (input.daily_message_limit !== undefined) data.daily_message_limit = input.daily_message_limit;
    if (input.max_import_batch_size !== undefined) data.max_import_batch_size = input.max_import_batch_size;
    if (input.max_storage_mb !== undefined) data.max_storage_mb = input.max_storage_mb;
    if (input.analytics_max_days !== undefined) data.analytics_max_days = input.analytics_max_days;
    if (input.features !== undefined) data.features = input.features;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;

    return prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async toggleActive(id: string) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Plan tidak ditemukan');

    return prisma.subscriptionPlan.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });
  }
}

export const adminPlanService = new AdminPlanService();
