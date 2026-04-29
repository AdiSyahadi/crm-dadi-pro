import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { paymentSettingsService } from './payment-settings.service';
import { paymentCallbackService } from './payment-callback.service';
import { AppError } from '../utils/app-error';

interface MidtransConfig {
  merchant_id: string;
  server_key: string;
  client_key: string;
  environment: string;
  is_enabled: boolean;
}

interface CreateSnapInput {
  deal_id: string;
  organization_id: string;
}

interface SnapResponse {
  token: string;
  redirect_url: string;
}

interface MidtransNotification {
  transaction_time: string;
  transaction_status: string;
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  fraud_status?: string;
  currency: string;
}

export class MidtransService {
  private getBaseUrl(environment: string): string {
    return environment === 'production'
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
  }

  private async getConfig(): Promise<MidtransConfig> {
    const config = await paymentSettingsService.getMidtransConfig();
    if (!config.is_enabled) {
      throw AppError.badRequest('Midtrans belum diaktifkan. Silakan aktifkan di Pengaturan.');
    }
    if (!config.server_key) {
      throw AppError.badRequest('Server Key Midtrans belum diisi. Silakan lengkapi di Pengaturan.');
    }
    return config;
  }

  /**
   * Create a Midtrans Snap transaction for a deal.
   * Returns snap token + redirect URL that frontend can use to open payment page.
   */
  async createSnapTransaction(input: CreateSnapInput): Promise<{
    snap_token: string;
    snap_url: string;
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

    // If deal already has a valid snap token and is still pending, return existing
    if (deal.midtrans_snap_token && deal.midtrans_snap_url && deal.payment_status === 'pending') {
      return {
        snap_token: deal.midtrans_snap_token,
        snap_url: deal.midtrans_snap_url,
        order_id: deal.midtrans_order_id!,
      };
    }

    // Generate unique order_id: DEAL-{deal_number}-{timestamp}
    const orderId = `${deal.deal_number}-${Date.now()}`;

    const baseUrl = this.getBaseUrl(config.environment);
    const authString = Buffer.from(`${config.server_key}:`).toString('base64');

    // Build Snap API payload
    const payload: Record<string, any> = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(deal.value)),
      },
      customer_details: {
        first_name: deal.contact?.name || 'Customer',
        phone: deal.contact?.phone_number || '',
        email: deal.contact?.email || undefined,
      },
      item_details: this.buildItemDetails(deal),
    };

    // Add callbacks
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    payload.callbacks = {
      finish: `${process.env.FRONTEND_URL || 'http://localhost:3002'}/dashboard/deals`,
    };

    try {
      const response = await axios.post<SnapResponse>(
        `${baseUrl}/snap/v1/transactions`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Basic ${authString}`,
          },
          timeout: 30000,
        },
      );

      const { token, redirect_url } = response.data;

      // Save snap token + order_id to deal
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          midtrans_order_id: orderId,
          midtrans_snap_token: token,
          midtrans_snap_url: redirect_url,
          payment_status: 'pending',
        },
      });

      // Log activity
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: 'Link pembayaran Midtrans dibuat',
          metadata: JSON.parse(JSON.stringify({
            order_id: orderId,
            amount: Math.round(Number(deal.value)),
            snap_url: redirect_url,
          })),
        },
      });

      console.log(`✅ Midtrans Snap created: order_id=${orderId}, deal=${deal.deal_number}`);

      return {
        snap_token: token,
        snap_url: redirect_url,
        order_id: orderId,
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.error_messages
        ? error.response.data.error_messages.join(', ')
        : error.message;
      console.error(`❌ Midtrans Snap failed: ${errMsg}`);
      throw AppError.badRequest(`Gagal membuat transaksi Midtrans: ${errMsg}`);
    }
  }

  /**
   * Verify Midtrans notification signature.
   * Signature = SHA512(order_id + status_code + gross_amount + server_key)
   */
  verifySignature(notification: MidtransNotification, serverKey: string): boolean {
    const input = `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`;
    const expected = crypto.createHash('sha512').update(input).digest('hex');
    return expected === notification.signature_key;
  }

  /**
   * Handle incoming Midtrans notification webhook.
   * Updates deal payment_status and auto-closes deal as WON on settlement.
   */
  async handleNotification(notification: MidtransNotification): Promise<{
    success: boolean;
    message: string;
  }> {
    const config = await paymentSettingsService.getMidtransConfig();

    if (!config.server_key) {
      console.error('❌ Midtrans notification: server_key not configured');
      return { success: false, message: 'Server key not configured' };
    }

    // Verify signature
    if (!this.verifySignature(notification, config.server_key)) {
      console.error(`❌ Midtrans notification: invalid signature for order ${notification.order_id}`);
      return { success: false, message: 'Invalid signature' };
    }

    // Find deal by midtrans_order_id
    const deal = await prisma.deal.findFirst({
      where: { midtrans_order_id: notification.order_id },
    });

    if (!deal) {
      console.warn(`⚠️ Midtrans notification: no deal found for order ${notification.order_id}`);
      return { success: false, message: `No deal found for order_id: ${notification.order_id}` };
    }

    const txStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;
    const paymentType = notification.payment_type;
    const grossAmount = parseFloat(notification.gross_amount);

    console.log(`📥 Midtrans notification: order=${notification.order_id}, status=${txStatus}, fraud=${fraudStatus}, type=${paymentType}`);

    // Update payment_status + payment_type on deal
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        payment_status: txStatus,
        midtrans_payment_type: paymentType,
      },
    });

    // Handle based on transaction_status
    if (txStatus === 'capture' || txStatus === 'settlement') {
      // For capture: only accept if fraud_status is 'accept'
      if (txStatus === 'capture' && fraudStatus !== 'accept') {
        await prisma.dealActivity.create({
          data: {
            deal_id: deal.id,
            type: 'NOTE_ADDED',
            title: `Pembayaran ditahan (fraud review): ${paymentType}`,
            metadata: JSON.parse(JSON.stringify({
              transaction_id: notification.transaction_id,
              fraud_status: fraudStatus,
              amount: grossAmount,
            })),
          },
        });
        return { success: true, message: 'Payment captured but pending fraud review' };
      }

      // Settlement / accepted capture → use existing paymentCallbackService to auto-close deal as WON
      if (!deal.closed_status) {
        await paymentCallbackService.processPayment({
          deal_id: deal.id,
          amount: grossAmount,
          payment_method: paymentType,
          payment_ref: notification.transaction_id,
          payer_name: undefined,
        });
      } else {
        // Deal already closed, just log activity
        await prisma.dealActivity.create({
          data: {
            deal_id: deal.id,
            type: 'PAYMENT_RECEIVED',
            title: `Pembayaran diterima via ${paymentType} (deal sudah ${deal.closed_status})`,
            metadata: JSON.parse(JSON.stringify({
              transaction_id: notification.transaction_id,
              amount: grossAmount,
              payment_type: paymentType,
            })),
          },
        });
      }
    } else if (txStatus === 'pending') {
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: `Menunggu pembayaran via ${paymentType}`,
          metadata: JSON.parse(JSON.stringify({
            transaction_id: notification.transaction_id,
            amount: grossAmount,
            payment_type: paymentType,
          })),
        },
      });
    } else if (txStatus === 'expire' || txStatus === 'cancel' || txStatus === 'deny') {
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: `Pembayaran ${txStatus === 'expire' ? 'kedaluwarsa' : txStatus === 'cancel' ? 'dibatalkan' : 'ditolak'}: ${paymentType}`,
          metadata: JSON.parse(JSON.stringify({
            transaction_id: notification.transaction_id,
            amount: grossAmount,
            status: txStatus,
          })),
        },
      });

      // Clear snap token so a new one can be generated
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          midtrans_snap_token: null,
          midtrans_snap_url: null,
        },
      });
    } else if (txStatus === 'refund' || txStatus === 'partial_refund') {
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'NOTE_ADDED',
          title: `Refund ${txStatus === 'partial_refund' ? 'sebagian' : 'penuh'}: ${paymentType}`,
          metadata: JSON.parse(JSON.stringify({
            transaction_id: notification.transaction_id,
            amount: grossAmount,
            status: txStatus,
          })),
        },
      });
    }

    return { success: true, message: `Notification processed: ${txStatus}` };
  }

  /**
   * Build item_details from deal products or single line item.
   */
  private buildItemDetails(deal: any): Array<{ id: string; price: number; quantity: number; name: string }> {
    if (deal.products && Array.isArray(deal.products) && deal.products.length > 0) {
      return (deal.products as any[]).map((p: any, idx: number) => ({
        id: `item-${idx + 1}`,
        price: Math.round(Number(p.price || 0)),
        quantity: Number(p.qty || 1),
        name: String(p.name || 'Item').substring(0, 50),
      }));
    }

    return [{
      id: 'deal-item',
      price: Math.round(Number(deal.value)),
      quantity: 1,
      name: String(deal.title).substring(0, 50),
    }];
  }

  /**
   * Check transaction status from Midtrans API.
   */
  async checkTransactionStatus(orderId: string): Promise<MidtransNotification | null> {
    const config = await this.getConfig();
    const baseUrl = config.environment === 'production'
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
    const authString = Buffer.from(`${config.server_key}:`).toString('base64');

    try {
      const response = await axios.get<MidtransNotification>(
        `${baseUrl}/v2/${orderId}/status`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${authString}`,
          },
          timeout: 15000,
        },
      );
      return response.data;
    } catch (error: any) {
      console.error(`❌ Midtrans status check failed for ${orderId}: ${error.message}`);
      return null;
    }
  }
}

export const midtransService = new MidtransService();
