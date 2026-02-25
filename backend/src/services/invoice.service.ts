import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';
import { WAApiClient } from './wa-api.client';
import { paymentSettingsService } from './payment-settings.service';

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

interface CreateInvoiceInput {
  organization_id: string;
  plan_id: string;
  amount: number;
  payment_method?: string;
  period_start?: Date;
  period_end?: Date;
  notes?: string;
}

interface ListInvoicesQuery {
  page?: number;
  limit?: number;
  status?: string;
  organization_id?: string;
}

export class InvoiceService {
  /** Admin: list all invoices across orgs */
  async listAll(query: ListInvoicesQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.organization_id) where.organization_id = query.organization_id;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          plan: { select: { id: true, name: true, plan_code: true, price: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Tenant: list invoices for own organization */
  async listByOrg(organizationId: string) {
    return prisma.invoice.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: {
        plan: { select: { id: true, name: true, plan_code: true, price: true } },
      },
    });
  }

  async getById(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, plan_code: true, price: true } },
      },
    });
    if (!invoice) throw AppError.notFound('Invoice tidak ditemukan');
    return invoice;
  }

  /** Admin creates invoice for an org (e.g. after org requests upgrade) */
  async create(input: CreateInvoiceInput) {
    // Validate org exists
    const org = await prisma.organization.findUnique({ where: { id: input.organization_id } });
    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');

    // Validate plan exists
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.plan_id } });
    if (!plan) throw AppError.notFound('Plan tidak ditemukan');

    return prisma.invoice.create({
      data: {
        invoice_number: generateInvoiceNumber(),
        organization_id: input.organization_id,
        plan_id: input.plan_id,
        amount: input.amount,
        payment_method: input.payment_method || 'manual_transfer',
        period_start: input.period_start,
        period_end: input.period_end,
        notes: input.notes,
        expired_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days to pay
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, plan_code: true, price: true } },
      },
    });
  }

  /** Tenant: upload payment proof for an invoice */
  async uploadProof(invoiceId: string, organizationId: string, proofUrl: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organization_id: organizationId },
    });
    if (!invoice) throw AppError.notFound('Invoice tidak ditemukan');
    if (invoice.status !== 'PENDING') {
      throw AppError.badRequest('Invoice ini sudah tidak bisa dibayar');
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        payment_proof_url: proofUrl,
        status: 'PAID',
        paid_at: new Date(),
      },
    });
  }

  /** Admin: verify payment and activate subscription */
  async verifyPayment(invoiceId: string, adminUserId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { plan: true },
    });
    if (!invoice) throw AppError.notFound('Invoice tidak ditemukan');
    if (invoice.status !== 'PAID') {
      throw AppError.badRequest('Invoice belum dibayar atau sudah diverifikasi');
    }

    // Update invoice status + activate org plan in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'VERIFIED',
          verified_by: adminUserId,
        },
      });

      // Activate plan on organization
      await tx.organization.update({
        where: { id: invoice.organization_id },
        data: {
          plan: invoice.plan.plan_code,
          subscription_plan_id: invoice.plan_id,
          subscription_status: 'ACTIVE',
          subscription_expires_at: invoice.period_end,
        },
      });

      return updatedInvoice;
    });

    // Fire-and-forget WA notification to buyer about verified payment
    this.sendVerifiedFollowUp(invoice.organization_id, invoice, invoice.plan).catch((err) => {
      console.error('[WA Verified] Failed to send verified notification:', err.message);
    });

    return result;
  }

  /**
   * Send WA message to the OWNER of the org confirming payment verification.
   * Uses the system WA API (SUPER_ADMIN org config or env vars).
   * Template loaded from PaymentConfig (admin-customizable).
   */
  private async sendVerifiedFollowUp(
    organizationId: string,
    invoice: any,
    plan: { name: string; price: number; plan_code: string },
  ) {
    // Check if verified follow-up is enabled
    const verifiedConfig = await paymentSettingsService.getVerifiedTemplate();
    if (!verifiedConfig.enabled) {
      console.log('[WA Verified] Verified follow-up disabled by admin, skipping');
      return;
    }

    // Find OWNER user with phone number
    const owner = await prisma.user.findFirst({
      where: { organization_id: organizationId, role: 'OWNER', phone: { not: null } },
      select: { phone: true, name: true },
    });
    if (!owner?.phone) {
      console.log('[WA Verified] No owner phone found, skipping WA notification');
      return;
    }

    // Get system WA API client
    const waClient = await this.getSystemWAClient();
    if (!waClient) {
      console.log('[WA Verified] No system WA API configured, skipping');
      return;
    }

    // Find an active/connected instance
    const instancesRes = await waClient.getInstances();
    const instances = instancesRes?.data || instancesRes || [];
    const activeInstance = instances.find(
      (i: any) => (i.status === 'CONNECTED' || i.status === 'connected') && i.is_active !== false,
    );
    if (!activeInstance) {
      console.log('[WA Verified] No active WA instance found, skipping');
      return;
    }

    const instanceId = activeInstance.id || activeInstance.instance_id;

    const formatRp = (n: number) =>
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    const periodEnd = invoice.period_end
      ? new Date(invoice.period_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    // Replace placeholders in template
    const message = verifiedConfig.template
      .replace(/\{name\}/g, owner.name || 'Kak')
      .replace(/\{plan_name\}/g, plan.name)
      .replace(/\{amount\}/g, formatRp(plan.price))
      .replace(/\{invoice_number\}/g, invoice.invoice_number)
      .replace(/\{period_end\}/g, periodEnd);

    await waClient.sendText(instanceId, owner.phone, message);
    console.log(`[WA Verified] Sent verified notification to ${owner.phone} for invoice ${invoice.invoice_number}`);
  }

  /** Admin: cancel an invoice */
  async cancel(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw AppError.notFound('Invoice tidak ditemukan');
    if (invoice.status === 'VERIFIED') {
      throw AppError.badRequest('Invoice yang sudah terverifikasi tidak bisa dibatalkan');
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });
  }

  /** Tenant: cancel own PENDING invoice */
  async cancelOwn(invoiceId: string, organizationId: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw AppError.notFound('Invoice tidak ditemukan');
    if (invoice.organization_id !== organizationId) {
      throw AppError.forbidden('Invoice bukan milik organisasi Anda');
    }
    if (invoice.status !== 'PENDING') {
      throw AppError.badRequest('Hanya invoice PENDING yang bisa dibatalkan');
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });
  }

  /** Tenant: change plan on an existing PENDING invoice */
  async changePlan(invoiceId: string, organizationId: string, newPlanId: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw AppError.notFound('Invoice tidak ditemukan');
    if (invoice.organization_id !== organizationId) {
      throw AppError.forbidden('Invoice bukan milik organisasi Anda');
    }
    if (invoice.status !== 'PENDING') {
      throw AppError.badRequest('Hanya invoice PENDING yang bisa diubah paketnya');
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } });
    if (!newPlan) throw AppError.notFound('Plan tidak ditemukan');
    if (!newPlan.is_active) throw AppError.badRequest('Plan ini tidak tersedia');

    // Same plan — no change needed
    if (invoice.plan_id === newPlanId) {
      throw AppError.badRequest('Paket yang dipilih sama dengan paket saat ini di invoice');
    }

    // Recalculate period_end based on new plan's billing cycle
    const periodStart = invoice.period_start || new Date();
    const periodEnd = new Date(periodStart);
    if (newPlan.billing_cycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        plan_id: newPlanId,
        amount: newPlan.price,
        period_end: periodEnd,
        notes: `Upgrade ke ${newPlan.name}`,
      },
      include: {
        plan: { select: { id: true, name: true, plan_code: true, price: true } },
      },
    });
  }

  /** Tenant: request plan upgrade — creates a PENDING invoice */
  async requestUpgrade(organizationId: string, planId: string, opts?: { userId?: string; phone?: string }) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw AppError.notFound('Organisasi tidak ditemukan');

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw AppError.notFound('Plan tidak ditemukan');
    if (!plan.is_active) throw AppError.badRequest('Plan ini tidak tersedia');

    // Save phone to requesting user's profile if provided
    if (opts?.phone && opts?.userId) {
      const normalized = opts.phone.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');
      if (normalized) {
        await prisma.user.update({
          where: { id: opts.userId },
          data: { phone: normalized },
        });
      }
    }

    // Check if org already has a pending invoice for same plan
    const existing = await prisma.invoice.findFirst({
      where: { organization_id: organizationId, plan_id: planId, status: 'PENDING' },
    });
    if (existing) throw AppError.badRequest('Sudah ada invoice pending untuk paket ini');

    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now);
    if (plan.billing_cycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: generateInvoiceNumber(),
        organization_id: organizationId,
        plan_id: planId,
        amount: plan.price,
        payment_method: 'manual_transfer',
        period_start: periodStart,
        period_end: periodEnd,
        notes: `Upgrade ke ${plan.name}`,
        expired_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      include: {
        plan: { select: { id: true, name: true, plan_code: true, price: true } },
      },
    });

    // Fire-and-forget WA follow-up to buyer
    this.sendUpgradeFollowUp(organizationId, invoice, plan).catch((err) => {
      console.error('[WA Follow-Up] Failed to send upgrade notification:', err.message);
    });

    return invoice;
  }

  /**
   * Resolve system-level WA API client for sending follow-up messages.
   * Priority:
   *   1. SUPER_ADMIN organization's WA API config (admin-configurable via UI)
   *   2. System env vars WA_API_BASE_URL + WA_API_KEY (fallback)
   */
  private async getSystemWAClient(): Promise<WAApiClient | null> {
    // 1. Try SUPER_ADMIN org's WA API config (managed via Settings UI)
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { organization_id: true },
    });

    if (superAdmin) {
      const org = await prisma.organization.findUnique({
        where: { id: superAdmin.organization_id },
        select: { wa_api_base_url: true, wa_api_key: true },
      });

      if (org?.wa_api_base_url && org?.wa_api_key) {
        console.log('[WA Follow-Up] Using SUPER_ADMIN org WA API config');
        return new WAApiClient(org.wa_api_base_url, org.wa_api_key);
      }
    }

    // 2. Fallback to env vars
    if (env.WA_API_BASE_URL && env.WA_API_KEY) {
      console.log('[WA Follow-Up] Using env vars WA API config');
      return new WAApiClient(env.WA_API_BASE_URL, env.WA_API_KEY);
    }

    return null;
  }

  /**
   * Send WA message to the OWNER of the org with payment instructions.
   * Uses the system WA API (SUPER_ADMIN org config or env vars).
   * Template loaded from PaymentConfig (admin-customizable).
   */
  private async sendUpgradeFollowUp(
    organizationId: string,
    invoice: any,
    plan: { name: string; price: number; billing_cycle: string },
  ) {
    // Check if follow-up is enabled
    const followUpConfig = await paymentSettingsService.getFollowUpTemplate();
    if (!followUpConfig.enabled) {
      console.log('[WA Follow-Up] Follow-up disabled by admin, skipping');
      return;
    }

    // Find OWNER user with phone number
    const owner = await prisma.user.findFirst({
      where: { organization_id: organizationId, role: 'OWNER', phone: { not: null } },
      select: { phone: true, name: true },
    });
    if (!owner?.phone) {
      console.log('[WA Follow-Up] No owner phone found, skipping WA notification');
      return;
    }

    // Get system WA API client
    const waClient = await this.getSystemWAClient();
    if (!waClient) {
      console.log('[WA Follow-Up] No system WA API configured (neither SUPER_ADMIN org nor env), skipping');
      return;
    }

    // Find an active/connected instance
    const instancesRes = await waClient.getInstances();
    const instances = instancesRes?.data || instancesRes || [];
    const activeInstance = instances.find(
      (i: any) => (i.status === 'CONNECTED' || i.status === 'connected') && i.is_active !== false,
    );
    if (!activeInstance) {
      console.log('[WA Follow-Up] No active WA instance found, skipping');
      return;
    }

    const instanceId = activeInstance.id || activeInstance.instance_id;

    // Fetch bank accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    const formatRp = (n: number) =>
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    const expiredAt = invoice.expired_at
      ? new Date(invoice.expired_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    let bankInfo = '';
    if (bankAccounts.length > 0) {
      bankInfo = '🏦 *Rekening Pembayaran:*\n\n' + bankAccounts
        .map((b) => `  🏦 ${b.bank_name}\n  No. Rek: ${b.account_number}\n  a.n. ${b.account_holder}`)
        .join('\n\n');
    }

    // Replace placeholders in template
    const message = followUpConfig.template
      .replace(/\{name\}/g, owner.name || 'Kak')
      .replace(/\{plan_name\}/g, plan.name)
      .replace(/\{amount\}/g, formatRp(plan.price))
      .replace(/\{invoice_number\}/g, invoice.invoice_number)
      .replace(/\{expired_at\}/g, expiredAt)
      .replace(/\{bank_accounts\}/g, bankInfo);

    await waClient.sendText(instanceId, owner.phone, message);
    console.log(`[WA Follow-Up] Sent upgrade notification to ${owner.phone} for invoice ${invoice.invoice_number}`);
  }
}

export const invoiceService = new InvoiceService();
