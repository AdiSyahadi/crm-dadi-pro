import axios from 'axios';
import { prisma } from '../config/database';
import { paymentSettingsService } from './payment-settings.service';
import { paymentCallbackService } from './payment-callback.service';
import { AppError } from '../utils/app-error';

interface FlipConfig {
  secret_key: string;
  validation_token: string;
  environment: string;
  is_enabled: boolean;
}

interface CreateBillInput {
  deal_id: string;
  organization_id: string;
}

interface FlipBillResponse {
  link_id: number;
  link_url: string;
  title: string;
  amount: number;
  status: string;
  // Other fields from Flip response
  [key: string]: any;
}

interface FlipCallbackPayload {
  id: number;
  bill_link: string;
  bill_link_id: number;
  bill_title: string;
  sender_name: string;
  sender_bank: string;
  sender_bank_type: string;
  amount: number;
  status: string;
  settlement_status?: string;
  created_from?: string;
  [key: string]: any;
}

export class FlipService {
  private getBaseUrl(environment: string): string {
    return environment === 'production'
      ? 'https://bigflip.id/api/v3'
      : 'https://bigflip.id/big_sandbox_api/v3';
  }

  private async getConfig(): Promise<FlipConfig> {
    const config = await paymentSettingsService.getFlipConfig();
    if (!config.is_enabled) {
      throw AppError.badRequest('Flip belum diaktifkan. Silakan aktifkan di Pengaturan.');
    }
    if (!config.secret_key) {
      throw AppError.badRequest('Secret Key Flip belum diisi. Silakan lengkapi di Pengaturan.');
    }
    return config;
  }

  /**
   * Create a Flip Bill (payment link) for a deal.
   * Returns the bill link URL that can be shared with customer.
   */
  async createBill(input: CreateBillInput): Promise<{
    link_id: number;
    link_url: string;
    order_id: string;
  }> {
    const config = await this.getConfig();

    const deal = await prisma.deal.findFirst({
      where: { id: input.deal_id, organization_id: input.organization_id },
      include: {
        contact: { select: { id: true, name: true, phone_number: true, email: true } },
        organization: { select: { name: true } },
      },
    });

    if (!deal) throw AppError.notFound('Deal tidak ditemukan');
    if (!deal.value || Number(deal.value) <= 0) {
      throw AppError.badRequest('Deal harus memiliki nilai (value) lebih dari 0');
    }

    // If deal already has a Flip link and payment is pending, return existing
    if (deal.flip_link_id && deal.flip_link_url && deal.payment_status === 'pending') {
      return {
        link_id: Number(deal.flip_link_id),
        link_url: deal.flip_link_url,
        order_id: deal.flip_order_id || '',
      };
    }

    const orderId = `${deal.deal_number}-${Date.now()}`;
    const baseUrl = this.getBaseUrl(config.environment);
    const authString = Buffer.from(`${config.secret_key}:`).toString('base64');

    // Build bill creation payload (form-urlencoded)
    const params = new URLSearchParams();
    params.append('title', String(deal.title).substring(0, 55)); // Flip max 55 chars
    params.append('amount', String(Math.round(Number(deal.value))));
    params.append('type', 'SINGLE'); // Single use bill
    params.append('expired_date', this.getExpiryDate()); // 24 hours from now
    params.append('redirect_url', `${process.env.FRONTEND_URL || 'http://localhost:3002'}/dashboard/deals`);
    params.append('is_address_required', '0');
    params.append('is_phone_number_required', '0');

    if (deal.contact?.name) {
      params.append('sender_name', deal.contact.name.substring(0, 50));
    }
    if (deal.contact?.email) {
      params.append('sender_email', deal.contact.email);
    }

    try {
      const response = await axios.post<FlipBillResponse>(
        `${baseUrl}/pwf/bill`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authString}`,
          },
          timeout: 30000,
        },
      );

      const bill = response.data;
      const linkUrl = bill.link_url;
      const linkId = bill.link_id;

      // Save Flip bill info to deal
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          flip_order_id: orderId,
          flip_link_id: String(linkId),
          flip_link_url: linkUrl,
          payment_status: 'pending',
        },
      });

      // Log activity
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: 'Link pembayaran Flip dibuat',
          metadata: JSON.parse(JSON.stringify({
            order_id: orderId,
            link_id: linkId,
            link_url: linkUrl,
            amount: Math.round(Number(deal.value)),
          })),
        },
      });

      console.log(`✅ Flip Bill created: link_id=${linkId}, deal=${deal.deal_number}`);

      return {
        link_id: linkId,
        link_url: linkUrl,
        order_id: orderId,
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.errors
        ? JSON.stringify(error.response.data.errors)
        : error.message;
      console.error(`❌ Flip Bill creation failed: ${errMsg}`);
      throw AppError.badRequest(`Gagal membuat bill Flip: ${errMsg}`);
    }
  }

  /**
   * Verify Flip callback token.
   * Flip sends a validation_token in the request that must match our configured token.
   */
  verifyCallback(token: string, validationToken: string): boolean {
    return token === validationToken;
  }

  /**
   * Handle incoming Flip payment callback.
   * Flip sends callback when bill is paid.
   */
  async handleCallback(payload: FlipCallbackPayload): Promise<{
    success: boolean;
    message: string;
  }> {
    const config = await paymentSettingsService.getFlipConfig();

    if (!config.secret_key) {
      console.error('❌ Flip callback: secret_key not configured');
      return { success: false, message: 'Secret key not configured' };
    }

    const linkId = String(payload.bill_link_id || payload.id);
    const status = (payload.status || '').toUpperCase();
    const amount = payload.amount;
    const senderName = payload.sender_name || '';
    const senderBank = payload.sender_bank || '';

    console.log(`📥 Flip callback: link_id=${linkId}, status=${status}, amount=${amount}, sender=${senderName}`);

    // Find deal by flip_link_id
    const deal = await prisma.deal.findFirst({
      where: { flip_link_id: linkId },
    });

    if (!deal) {
      console.warn(`⚠️ Flip callback: no deal found for link_id ${linkId}`);
      return { success: false, message: `No deal found for link_id: ${linkId}` };
    }

    // Update payment status
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        payment_status: status.toLowerCase(),
      },
    });

    // Handle based on status
    if (status === 'SUCCESSFUL' || status === 'DONE') {
      // Payment successful → auto-close deal as WON
      if (!deal.closed_status) {
        await paymentCallbackService.processPayment({
          deal_id: deal.id,
          amount,
          payment_method: `Flip (${senderBank})`,
          payment_ref: `FLIP-${linkId}`,
          payer_name: senderName || undefined,
        });
      } else {
        await prisma.dealActivity.create({
          data: {
            deal_id: deal.id,
            type: 'PAYMENT_RECEIVED',
            title: `Pembayaran diterima via Flip (deal sudah ${deal.closed_status})`,
            metadata: JSON.parse(JSON.stringify({
              link_id: linkId,
              amount,
              sender_name: senderName,
              sender_bank: senderBank,
            })),
          },
        });
      }
    } else if (status === 'PENDING') {
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: `Menunggu pembayaran via Flip`,
          metadata: JSON.parse(JSON.stringify({
            link_id: linkId,
            amount,
            sender_name: senderName,
          })),
        },
      });
    } else if (status === 'CANCELLED' || status === 'FAILED' || status === 'EXPIRED') {
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: `Pembayaran Flip ${status === 'EXPIRED' ? 'kedaluwarsa' : status === 'CANCELLED' ? 'dibatalkan' : 'gagal'}`,
          metadata: JSON.parse(JSON.stringify({
            link_id: linkId,
            amount,
            status,
          })),
        },
      });

      // Clear Flip link so a new one can be generated
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          flip_link_id: null,
          flip_link_url: null,
        },
      });
    }

    return { success: true, message: `Callback processed: ${status}` };
  }

  /**
   * Get bill status from Flip API.
   */
  async getBillStatus(linkId: string): Promise<any> {
    const config = await this.getConfig();
    const baseUrl = this.getBaseUrl(config.environment);
    const authString = Buffer.from(`${config.secret_key}:`).toString('base64');

    try {
      const response = await axios.get(
        `${baseUrl}/pwf/${linkId}/bill`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
          },
          timeout: 15000,
        },
      );
      return response.data;
    } catch (error: any) {
      console.error(`❌ Flip bill status check failed for ${linkId}: ${error.message}`);
      return null;
    }
  }

  private getExpiryDate(): string {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    // Flip format: YYYY-MM-DD HH:mm
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  }
}

export const flipService = new FlipService();
