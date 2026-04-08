import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateReceiptInput, UpdateReceiptInput, ListReceiptsInput, ReceiptConfigInput } from '../validators/receipt.validator';
import { generateReceiptPdf, ReceiptConfig } from './receipt-generator.service';
import { messageService } from './message.service';

async function generateReceiptNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const prefix = `RCP-${year}${month}`;

  const last = await prisma.receipt.findFirst({
    where: {
      organization_id: organizationId,
      receipt_number: { startsWith: prefix },
    },
    orderBy: { receipt_number: 'desc' },
    select: { receipt_number: true },
  });

  let nextSeq = 1;
  if (last) {
    const parts = last.receipt_number.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
}

export class ReceiptService {
  async list(organizationId: string, input: ListReceiptsInput) {
    const { page, limit, status, type, deal_id, search, sort_by, sort_order } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (deal_id) where.deal_id = deal_id;
    if (search) {
      where.OR = [
        { receipt_number: { contains: search } },
        { recipient_name: { contains: search } },
        { payment_ref: { contains: search } },
      ];
    }

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          deal: { select: { id: true, title: true, deal_number: true } },
        },
      }),
      prisma.receipt.count({ where }),
    ]);

    return {
      receipts,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, id: string) {
    const receipt = await prisma.receipt.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        deal: { select: { id: true, title: true, deal_number: true } },
        tracked_link: { select: { id: true, tracking_code: true, original_url: true } },
      },
    });
    if (!receipt) throw AppError.notFound('Receipt not found');
    return receipt;
  }

  async create(organizationId: string, input: CreateReceiptInput) {
    // Verify deal if provided
    if (input.deal_id) {
      const deal = await prisma.deal.findFirst({
        where: { id: input.deal_id, organization_id: organizationId },
      });
      if (!deal) throw AppError.notFound('Deal not found');
    }

    let attempts = 0;
    while (attempts < 3) {
      const receiptNumber = await generateReceiptNumber(organizationId);
      try {
        // Get org config for PDF generation
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { receipt_config: true, name: true },
        });
        const config = (org?.receipt_config as ReceiptConfig | null) || {};
        if (!config.org_name) config.org_name = org?.name;

        // Generate PDF
        const pdfUrl = await generateReceiptPdf({
          receipt_number: receiptNumber,
          type: input.type,
          recipient_name: input.recipient_name,
          recipient_phone: input.recipient_phone,
          recipient_email: input.recipient_email,
          items: input.items,
          subtotal: input.subtotal,
          tax_amount: input.tax_amount,
          total_amount: input.total_amount,
          currency: input.currency,
          payment_method: input.payment_method,
          payment_ref: input.payment_ref,
          notes: input.notes,
          footer_text: input.footer_text,
          created_at: new Date(),
          config,
        });

        const receipt = await prisma.receipt.create({
          data: {
            organization_id: organizationId,
            deal_id: input.deal_id || null,
            receipt_number: receiptNumber,
            type: input.type,
            status: 'DRAFT',
            recipient_name: input.recipient_name,
            recipient_phone: input.recipient_phone || null,
            recipient_email: input.recipient_email || null,
            items: JSON.parse(JSON.stringify(input.items)),
            subtotal: input.subtotal,
            tax_amount: input.tax_amount,
            total_amount: input.total_amount,
            currency: input.currency,
            payment_method: input.payment_method || null,
            payment_ref: input.payment_ref || null,
            notes: input.notes || null,
            footer_text: input.footer_text || null,
            pdf_url: pdfUrl,
          },
          include: {
            deal: { select: { id: true, title: true, deal_number: true } },
          },
        });

        return receipt;
      } catch (err: any) {
        if (err.code === 'P2002' && attempts < 2) {
          attempts++;
          continue;
        }
        throw err;
      }
    }
    throw AppError.badRequest('Failed to generate unique receipt number');
  }

  async update(organizationId: string, id: string, input: UpdateReceiptInput) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === 'VOIDED') {
      throw AppError.badRequest('Cannot edit a voided receipt');
    }
    if (existing.status === 'SENT') {
      throw AppError.badRequest('Cannot edit a sent receipt. Create a revision instead.');
    }

    const updateData: any = {};
    if (input.recipient_name !== undefined) updateData.recipient_name = input.recipient_name;
    if (input.recipient_phone !== undefined) updateData.recipient_phone = input.recipient_phone;
    if (input.recipient_email !== undefined) updateData.recipient_email = input.recipient_email;
    if (input.items !== undefined) updateData.items = JSON.parse(JSON.stringify(input.items));
    if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
    if (input.tax_amount !== undefined) updateData.tax_amount = input.tax_amount;
    if (input.total_amount !== undefined) updateData.total_amount = input.total_amount;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.payment_method !== undefined) updateData.payment_method = input.payment_method;
    if (input.payment_ref !== undefined) updateData.payment_ref = input.payment_ref;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.footer_text !== undefined) updateData.footer_text = input.footer_text;
    if (input.type !== undefined) updateData.type = input.type;

    // Regenerate PDF if items/amounts changed
    if (input.items || input.total_amount || input.recipient_name || input.type) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { receipt_config: true, name: true },
      });
      const config = (org?.receipt_config as ReceiptConfig | null) || {};
      if (!config.org_name) config.org_name = org?.name;

      const merged = { ...existing, ...updateData };
      const pdfUrl = await generateReceiptPdf({
        receipt_number: existing.receipt_number,
        type: merged.type,
        recipient_name: merged.recipient_name,
        recipient_phone: merged.recipient_phone,
        recipient_email: merged.recipient_email,
        items: merged.items as any,
        subtotal: Number(merged.subtotal),
        tax_amount: Number(merged.tax_amount),
        total_amount: Number(merged.total_amount),
        currency: merged.currency,
        payment_method: merged.payment_method,
        payment_ref: merged.payment_ref,
        notes: merged.notes,
        footer_text: merged.footer_text,
        created_at: existing.created_at,
        config,
      });
      updateData.pdf_url = pdfUrl;
    }

    return prisma.receipt.update({
      where: { id },
      data: updateData,
      include: {
        deal: { select: { id: true, title: true, deal_number: true } },
      },
    });
  }

  async void(organizationId: string, id: string, reason?: string) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === 'VOIDED') {
      throw AppError.badRequest('Receipt is already voided');
    }

    return prisma.receipt.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voided_at: new Date(),
        voided_reason: reason || null,
      },
      include: {
        deal: { select: { id: true, title: true, deal_number: true } },
      },
    });
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.getById(organizationId, id);
    if (existing.status !== 'DRAFT') {
      throw AppError.badRequest('Only draft receipts can be deleted');
    }
    await prisma.receipt.delete({ where: { id } });
  }

  async sendViaWA(organizationId: string, id: string) {
    const receipt = await this.getById(organizationId, id);
    if (!receipt.pdf_url) {
      throw AppError.badRequest('Receipt has no PDF generated');
    }
    if (!receipt.deal_id) {
      throw AppError.badRequest('Receipt is not linked to a deal');
    }

    const deal = await prisma.deal.findFirst({
      where: { id: receipt.deal_id, organization_id: organizationId },
      select: { conversation_id: true },
    });

    if (!deal?.conversation_id) {
      throw AppError.badRequest('Deal has no conversation to send receipt to');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const fullPdfUrl = `${appUrl}${receipt.pdf_url}`;

    await messageService.sendMedia(
      organizationId,
      deal.conversation_id,
      fullPdfUrl,
      `Kwitansi #${receipt.receipt_number}`,
      'document',
      '',
    );

    await prisma.receipt.update({
      where: { id },
      data: { status: 'SENT', sent_via_wa: true, sent_at: new Date() },
    });

    return this.getById(organizationId, id);
  }

  // Receipt config (org-level white-label settings)
  async getConfig(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { receipt_config: true },
    });
    return org?.receipt_config || {};
  }

  async updateConfig(organizationId: string, config: any) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { receipt_config: JSON.parse(JSON.stringify(config)) },
    });
    return config;
  }

  // Summary stats
  async summary(organizationId: string) {
    const [total, draft, sent, voided, totalAmount] = await Promise.all([
      prisma.receipt.count({ where: { organization_id: organizationId } }),
      prisma.receipt.count({ where: { organization_id: organizationId, status: 'DRAFT' } }),
      prisma.receipt.count({ where: { organization_id: organizationId, status: 'SENT' } }),
      prisma.receipt.count({ where: { organization_id: organizationId, status: 'VOIDED' } }),
      prisma.receipt.aggregate({
        where: { organization_id: organizationId, status: { not: 'VOIDED' } },
        _sum: { total_amount: true },
      }),
    ]);

    return {
      total,
      draft,
      sent,
      voided,
      total_amount: Number(totalAmount._sum.total_amount || 0),
    };
  }
}

export const receiptService = new ReceiptService();
