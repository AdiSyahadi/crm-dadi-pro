import { prisma } from '../config/database';
import { dispatchWebhookEvent } from './webhook-dispatcher.service';
import { generateReceiptPdf, ReceiptConfig, ReceiptItem } from './receipt-generator.service';
import { messageService } from './message.service';

interface PaymentCallbackInput {
  tracking_code?: string;
  deal_id?: string;
  phone_number?: string;
  amount: number;
  payment_method?: string;
  payment_ref?: string;
  payer_name?: string;
  metadata?: Record<string, any>;
}

export class PaymentCallbackService {
  /**
   * Process incoming payment notification from external ecommerce/donation platform.
   * Match deal by: tracking_code (priority 1) → deal_id (priority 2) → phone_number (priority 3)
   * Auto-close deal as WON if found and not already closed.
   */
  async processPayment(input: PaymentCallbackInput): Promise<{
    success: boolean;
    deal_id?: string;
    deal_number?: string;
    action?: string;
    message: string;
  }> {
    let deal: any = null;
    let trackedLink: any = null;

    // Priority 1: Match by tracking_code
    if (input.tracking_code) {
      trackedLink = await prisma.trackedLink.findUnique({
        where: { tracking_code: input.tracking_code },
        include: { deal: true },
      });
      if (trackedLink) {
        deal = trackedLink.deal;
      }
    }

    // Priority 2: Match by deal_id
    if (!deal && input.deal_id) {
      deal = await prisma.deal.findUnique({
        where: { id: input.deal_id },
      });
    }

    // Priority 3: Match by phone_number (find most recent open deal for this contact)
    if (!deal && input.phone_number) {
      const phone = input.phone_number.replace(/[^0-9]/g, '');
      const contact = await prisma.contact.findFirst({
        where: { phone_number: { endsWith: phone.slice(-10) } },
      });
      if (contact) {
        deal = await prisma.deal.findFirst({
          where: {
            contact_id: contact.id,
            closed_status: null,
          },
          orderBy: { created_at: 'desc' },
        });
      }
    }

    if (!deal) {
      return { success: false, message: 'No matching deal found' };
    }

    // If deal is already closed, just record the payment activity
    if (deal.closed_status) {
      await prisma.dealActivity.create({
        data: {
          deal_id: deal.id,
          type: 'PAYMENT_RECEIVED',
          title: `Payment received (deal already ${deal.closed_status})`,
          metadata: JSON.parse(JSON.stringify({
            amount: input.amount,
            payment_method: input.payment_method,
            payment_ref: input.payment_ref,
            payer_name: input.payer_name,
          })),
        },
      });

      return {
        success: true,
        deal_id: deal.id,
        deal_number: deal.deal_number,
        action: 'activity_logged',
        message: `Deal already ${deal.closed_status}, payment activity recorded`,
      };
    }

    // Auto-close deal as WON
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stage: 'WON',
        closed_status: 'WON',
        actual_close_date: new Date(),
        value: input.amount,
        win_probability: 100,
        won_notes: `Auto-closed by payment callback. Ref: ${input.payment_ref || 'N/A'}`,
      },
    });

    // Mark tracked link as converted if applicable
    if (trackedLink) {
      await prisma.trackedLink.update({
        where: { id: trackedLink.id },
        data: {
          is_converted: true,
          converted_at: new Date(),
          conversion_value: input.amount,
          payment_ref: input.payment_ref || null,
        },
      });
    }

    // Log payment activity
    await prisma.dealActivity.create({
      data: {
        deal_id: deal.id,
        type: 'PAYMENT_RECEIVED',
        title: `Payment received: ${input.amount}`,
        metadata: JSON.parse(JSON.stringify({
          amount: input.amount,
          payment_method: input.payment_method,
          payment_ref: input.payment_ref,
          payer_name: input.payer_name,
          tracking_code: input.tracking_code,
          auto_closed: true,
        })),
      },
    });

    // Log WON activity
    await prisma.dealActivity.create({
      data: {
        deal_id: deal.id,
        type: 'WON',
        title: 'Deal auto-closed as WON (payment received)',
        metadata: JSON.parse(JSON.stringify({
          payment_ref: input.payment_ref,
          amount: input.amount,
        })),
      },
    });

    // Dispatch webhook event
    const fullDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      include: {
        contact: { select: { id: true, name: true, phone_number: true } },
        assigned_to: { select: { id: true, name: true } },
      },
    });

    dispatchWebhookEvent(deal.organization_id, 'deal.won', {
      deal: fullDeal,
      auto_closed: true,
      payment: {
        amount: input.amount,
        payment_method: input.payment_method,
        payment_ref: input.payment_ref,
      },
    });

    // Auto-generate and send receipt if org has receipt_config
    this._autoSendReceipt(deal, fullDeal, input, trackedLink).catch((err) => {
      console.error(`❌ Auto-send receipt failed for deal ${deal.id}: ${err.message}`);
    });

    return {
      success: true,
      deal_id: deal.id,
      deal_number: deal.deal_number,
      action: 'auto_closed_won',
      message: 'Deal auto-closed as WON',
    };
  }

  private async _autoSendReceipt(
    deal: any,
    fullDeal: any,
    input: PaymentCallbackInput,
    trackedLink: any,
  ): Promise<void> {
    // Get org with receipt_config
    const org = await prisma.organization.findUnique({
      where: { id: deal.organization_id },
      select: { id: true, receipt_config: true, name: true },
    });

    const config = (org?.receipt_config as ReceiptConfig | null) || {};
    if (!config.org_name) config.org_name = org?.name;

    // Generate receipt number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await prisma.receipt.count({
      where: { organization_id: deal.organization_id },
    });
    const receiptNumber = `RCP-${year}${month}-${String(count + 1).padStart(4, '0')}`;

    // Build items from deal products or a simple single line item
    let items: ReceiptItem[] = [];
    if (deal.products && Array.isArray(deal.products)) {
      items = (deal.products as any[]).map((p) => ({
        name: p.name || 'Item',
        qty: p.qty || 1,
        price: p.price || 0,
        subtotal: p.subtotal || p.price * (p.qty || 1),
      }));
    } else {
      items = [{
        name: deal.title,
        qty: 1,
        price: input.amount,
        subtotal: input.amount,
      }];
    }

    const totalAmount = input.amount;
    const subtotal = totalAmount;

    // Generate PDF
    const pdfUrl = await generateReceiptPdf({
      receipt_number: receiptNumber,
      type: 'invoice',
      recipient_name: input.payer_name || fullDeal?.contact?.name || 'Customer',
      recipient_phone: fullDeal?.contact?.phone_number,
      items,
      subtotal,
      tax_amount: 0,
      total_amount: totalAmount,
      currency: deal.currency || 'IDR',
      payment_method: input.payment_method,
      payment_ref: input.payment_ref,
      created_at: new Date(),
      config,
    });

    // Save receipt record
    const receipt = await prisma.receipt.create({
      data: {
        organization_id: deal.organization_id,
        deal_id: deal.id,
        tracked_link_id: trackedLink?.id || null,
        receipt_number: receiptNumber,
        type: 'invoice',
        status: 'DRAFT',
        recipient_name: input.payer_name || fullDeal?.contact?.name || 'Customer',
        recipient_phone: fullDeal?.contact?.phone_number,
        items: JSON.parse(JSON.stringify(items)),
        subtotal,
        tax_amount: 0,
        total_amount: totalAmount,
        currency: deal.currency || 'IDR',
        payment_method: input.payment_method,
        payment_ref: input.payment_ref,
        pdf_url: pdfUrl,
      },
    });

    // Send via WA if contact has phone and conversation exists
    if (fullDeal?.contact?.phone_number && deal.conversation_id) {
      try {
        const appUrl = process.env.APP_URL || 'http://localhost:5000';
        const fullPdfUrl = `${appUrl}${pdfUrl}`;

        await messageService.sendMedia(
          deal.organization_id,
          deal.conversation_id,
          fullPdfUrl,
          `Kwitansi #${receiptNumber} - Terima kasih atas pembayaran Anda.`,
          'document',
          '',
        );

        await prisma.receipt.update({
          where: { id: receipt.id },
          data: { status: 'SENT', sent_via_wa: true, sent_at: new Date() },
        });

        // Log activity
        await prisma.dealActivity.create({
          data: {
            deal_id: deal.id,
            type: 'RECEIPT_SENT',
            title: `Receipt #${receiptNumber} sent via WhatsApp`,
            metadata: JSON.parse(JSON.stringify({ receipt_id: receipt.id, receipt_number: receiptNumber })),
          },
        });

        console.log(`✅ Auto receipt sent: ${receiptNumber} → ${fullDeal.contact.phone_number}`);
      } catch (err: any) {
        console.error(`❌ Failed to send receipt via WA: ${err.message}`);
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }
}

export const paymentCallbackService = new PaymentCallbackService();
