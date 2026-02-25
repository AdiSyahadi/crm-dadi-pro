import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

// ===================== BANK ACCOUNTS =====================

interface CreateBankAccountInput {
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active?: boolean;
  sort_order?: number;
}

interface UpdateBankAccountInput {
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  is_active?: boolean;
  sort_order?: number;
}

export class PaymentSettingsService {
  /** List all bank accounts (admin view — all, public view — active only) */
  async listBankAccounts(activeOnly = false) {
    const where = activeOnly ? { is_active: true } : {};
    return prisma.bankAccount.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async getBankAccount(id: string) {
    const account = await prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw AppError.notFound('Rekening bank tidak ditemukan');
    return account;
  }

  async createBankAccount(input: CreateBankAccountInput) {
    return prisma.bankAccount.create({
      data: {
        bank_name: input.bank_name,
        account_number: input.account_number,
        account_holder: input.account_holder,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      },
    });
  }

  async updateBankAccount(id: string, input: UpdateBankAccountInput) {
    await this.getBankAccount(id); // Ensure exists
    return prisma.bankAccount.update({
      where: { id },
      data: input,
    });
  }

  async deleteBankAccount(id: string) {
    await this.getBankAccount(id); // Ensure exists
    return prisma.bankAccount.delete({ where: { id } });
  }

  // ===================== PAYMENT CONFIG (Midtrans etc.) =====================

  async listPaymentConfigs() {
    return prisma.paymentConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getPaymentConfig(key: string) {
    return prisma.paymentConfig.findUnique({ where: { key } });
  }

  async upsertPaymentConfig(key: string, value: string, label?: string) {
    return prisma.paymentConfig.upsert({
      where: { key },
      update: { value, label: label ?? undefined },
      create: { key, value, label },
    });
  }

  async deletePaymentConfig(key: string) {
    const existing = await prisma.paymentConfig.findUnique({ where: { key } });
    if (!existing) throw AppError.notFound('Config tidak ditemukan');
    return prisma.paymentConfig.delete({ where: { key } });
  }

  /** Bulk upsert Midtrans config */
  async saveMidtransConfig(config: {
    server_key?: string;
    client_key?: string;
    environment?: string; // 'sandbox' | 'production'
    is_enabled?: string;  // 'true' | 'false'
  }) {
    const ops: Promise<any>[] = [];
    if (config.server_key !== undefined) {
      ops.push(this.upsertPaymentConfig('midtrans_server_key', config.server_key, 'Midtrans Server Key'));
    }
    if (config.client_key !== undefined) {
      ops.push(this.upsertPaymentConfig('midtrans_client_key', config.client_key, 'Midtrans Client Key'));
    }
    if (config.environment !== undefined) {
      ops.push(this.upsertPaymentConfig('midtrans_environment', config.environment, 'Midtrans Environment'));
    }
    if (config.is_enabled !== undefined) {
      ops.push(this.upsertPaymentConfig('midtrans_is_enabled', config.is_enabled, 'Midtrans Enabled'));
    }
    await Promise.all(ops);
    return this.getMidtransConfig();
  }

  /** Get Midtrans config as structured object */
  async getMidtransConfig() {
    const rows = await prisma.paymentConfig.findMany({
      where: { key: { startsWith: 'midtrans_' } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      server_key: map['midtrans_server_key'] || '',
      client_key: map['midtrans_client_key'] || '',
      environment: map['midtrans_environment'] || 'sandbox',
      is_enabled: map['midtrans_is_enabled'] === 'true',
    };
  }

  /** Public: get active bank accounts for tenant payment page */
  async getPublicPaymentInfo() {
    const bankAccounts = await this.listBankAccounts(true);
    const midtransEnabled = await this.getPaymentConfig('midtrans_is_enabled');
    return {
      bank_accounts: bankAccounts,
      midtrans_enabled: midtransEnabled?.value === 'true',
    };
  }

  // ===================== FOLLOW-UP WA TEMPLATE =====================

  private static DEFAULT_FOLLOWUP_TEMPLATE = [
    'Halo {name} 👋',
    '',
    'Terima kasih telah memilih paket *{plan_name}*! 🎉',
    '',
    '📋 *Detail Invoice:*',
    'No. Invoice: {invoice_number}',
    'Paket: {plan_name}',
    'Total Bayar: *{amount}*',
    'Batas Bayar: {expired_at}',
    '',
    '{bank_accounts}',
    '',
    '📌 *Cara Pembayaran:*',
    '1. Transfer sesuai jumlah tagihan ke salah satu rekening di atas',
    '2. Simpan/screenshot bukti transfer',
    '3. Login ke CRM → Billing → klik "Upload Bukti"',
    '4. Upload foto bukti transfer',
    '5. Tunggu verifikasi admin (maks 1x24 jam)',
    '',
    'Jika ada pertanyaan, silakan hubungi admin. Terima kasih! 🙏',
  ].join('\n');

  async getFollowUpTemplate() {
    const enabled = await this.getPaymentConfig('followup_wa_enabled');
    const template = await this.getPaymentConfig('followup_wa_template');
    return {
      enabled: enabled?.value !== 'false', // default = true
      template: template?.value || PaymentSettingsService.DEFAULT_FOLLOWUP_TEMPLATE,
    };
  }

  async saveFollowUpTemplate(data: { enabled?: boolean; template?: string }) {
    const ops: Promise<any>[] = [];
    if (data.enabled !== undefined) {
      ops.push(this.upsertPaymentConfig('followup_wa_enabled', String(data.enabled), 'Follow-Up WA Enabled'));
    }
    if (data.template !== undefined) {
      ops.push(this.upsertPaymentConfig('followup_wa_template', data.template, 'Follow-Up WA Template'));
    }
    await Promise.all(ops);
    return this.getFollowUpTemplate();
  }

  // ===================== VERIFIED WA TEMPLATE =====================

  private static DEFAULT_VERIFIED_TEMPLATE = [
    'Halo {name} 👋',
    '',
    'Pembayaran Anda telah kami *verifikasi*! ✅',
    '',
    '📋 *Detail:*',
    'No. Invoice: {invoice_number}',
    'Paket: *{plan_name}*',
    'Total: *{amount}*',
    '',
    '🎉 Paket *{plan_name}* Anda sudah aktif dan siap digunakan!',
    'Masa berlaku sampai: {period_end}',
    '',
    'Terima kasih telah menggunakan *Power WA*! 🙏',
  ].join('\n');

  async getVerifiedTemplate() {
    const enabled = await this.getPaymentConfig('verified_wa_enabled');
    const template = await this.getPaymentConfig('verified_wa_template');
    return {
      enabled: enabled?.value !== 'false', // default = true
      template: template?.value || PaymentSettingsService.DEFAULT_VERIFIED_TEMPLATE,
    };
  }

  async saveVerifiedTemplate(data: { enabled?: boolean; template?: string }) {
    const ops: Promise<any>[] = [];
    if (data.enabled !== undefined) {
      ops.push(this.upsertPaymentConfig('verified_wa_enabled', String(data.enabled), 'Verified WA Enabled'));
    }
    if (data.template !== undefined) {
      ops.push(this.upsertPaymentConfig('verified_wa_template', data.template, 'Verified WA Template'));
    }
    await Promise.all(ops);
    return this.getVerifiedTemplate();
  }
}

export const paymentSettingsService = new PaymentSettingsService();
