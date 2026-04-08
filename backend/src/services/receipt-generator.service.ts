import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

// Use standard fonts available everywhere
const printer = new (PdfPrinter as any)({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

export interface ReceiptConfig {
  org_name?: string;
  org_address?: string;
  org_phone?: string;
  org_email?: string;
  logo_url?: string;
  primary_color?: string;
  footer_text?: string;
  signature_name?: string;
  signature_title?: string;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface GenerateReceiptInput {
  receipt_number: string;
  type: string; // invoice | donation | zakat | service | custom
  recipient_name: string;
  recipient_phone?: string;
  recipient_email?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_method?: string;
  payment_ref?: string;
  notes?: string;
  footer_text?: string;
  created_at: Date;
  config: ReceiptConfig;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'IDR') {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

function getTitle(type: string): string {
  switch (type) {
    case 'donation': return 'KWITANSI DONASI';
    case 'zakat': return 'KWITANSI ZAKAT';
    case 'service': return 'KWITANSI LAYANAN';
    case 'custom': return 'KWITANSI';
    case 'invoice':
    default: return 'INVOICE';
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function generateReceiptPdf(input: GenerateReceiptInput): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `receipt-${uuid()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    const primaryColor = input.config.primary_color || '#1a56db';

    // Build header
    const headerContent: Content[] = [];

    // Org info block (right-aligned header)
    const orgInfo: Content[] = [];
    if (input.config.org_name) {
      orgInfo.push({ text: input.config.org_name, fontSize: 14, bold: true, color: primaryColor });
    }
    if (input.config.org_address) {
      orgInfo.push({ text: input.config.org_address, fontSize: 9, color: '#666666', margin: [0, 2, 0, 0] });
    }
    if (input.config.org_phone) {
      orgInfo.push({ text: `Telp: ${input.config.org_phone}`, fontSize: 9, color: '#666666' });
    }
    if (input.config.org_email) {
      orgInfo.push({ text: input.config.org_email, fontSize: 9, color: '#666666' });
    }

    headerContent.push({
      columns: [
        { stack: orgInfo, width: '*' },
        {
          stack: [
            { text: getTitle(input.type), fontSize: 18, bold: true, alignment: 'right' as const, color: primaryColor },
            { text: `#${input.receipt_number}`, fontSize: 10, alignment: 'right' as const, color: '#666666', margin: [0, 4, 0, 0] },
            { text: formatDate(input.created_at), fontSize: 9, alignment: 'right' as const, color: '#666666', margin: [0, 2, 0, 0] },
          ],
          width: 'auto',
        },
      ],
      margin: [0, 0, 0, 20],
    });

    // Horizontal line
    headerContent.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: primaryColor }],
      margin: [0, 0, 0, 15],
    });

    // Recipient info
    const recipientLines: Content[] = [
      { text: 'Kepada:', fontSize: 9, color: '#999999', margin: [0, 0, 0, 2] },
      { text: input.recipient_name, fontSize: 11, bold: true },
    ];
    if (input.recipient_phone) {
      recipientLines.push({ text: input.recipient_phone, fontSize: 9, color: '#666666' });
    }
    if (input.recipient_email) {
      recipientLines.push({ text: input.recipient_email, fontSize: 9, color: '#666666' });
    }

    const paymentLines: Content[] = [];
    if (input.payment_method) {
      paymentLines.push({ text: `Metode: ${input.payment_method}`, fontSize: 9, color: '#666666' });
    }
    if (input.payment_ref) {
      paymentLines.push({ text: `Ref: ${input.payment_ref}`, fontSize: 9, color: '#666666' });
    }

    headerContent.push({
      columns: [
        { stack: recipientLines, width: '*' },
        { stack: paymentLines.length > 0 ? paymentLines : [{ text: '' }], width: 'auto', alignment: 'right' as const },
      ],
      margin: [0, 0, 0, 20],
    });

    // Items table
    const tableHeader: TableCell[] = [
      { text: 'No', style: 'tableHeader', alignment: 'center' as const },
      { text: 'Item', style: 'tableHeader' },
      { text: 'Qty', style: 'tableHeader', alignment: 'center' as const },
      { text: 'Harga', style: 'tableHeader', alignment: 'right' as const },
      { text: 'Subtotal', style: 'tableHeader', alignment: 'right' as const },
    ];

    const tableRows: TableCell[][] = input.items.map((item, idx) => [
      { text: String(idx + 1), alignment: 'center' as const, fontSize: 9 },
      { text: item.name, fontSize: 9 },
      { text: String(item.qty), alignment: 'center' as const, fontSize: 9 },
      { text: formatCurrency(item.price, input.currency), alignment: 'right' as const, fontSize: 9 },
      { text: formatCurrency(item.subtotal, input.currency), alignment: 'right' as const, fontSize: 9 },
    ]);

    // Summary rows
    const summaryContent: Content[] = [
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 200,
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  { text: 'Subtotal', fontSize: 9, alignment: 'right' as const, border: [false, false, false, false] },
                  { text: formatCurrency(input.subtotal, input.currency), fontSize: 9, alignment: 'right' as const, border: [false, false, false, false] },
                ],
                ...(input.tax_amount > 0 ? [[
                  { text: 'Pajak', fontSize: 9, alignment: 'right' as const, border: [false, false, false, false] },
                  { text: formatCurrency(input.tax_amount, input.currency), fontSize: 9, alignment: 'right' as const, border: [false, false, false, false] },
                ] as TableCell[]] : []),
                [
                  { text: 'TOTAL', fontSize: 11, bold: true, alignment: 'right' as const, color: primaryColor, border: [false, true, false, false] },
                  { text: formatCurrency(input.total_amount, input.currency), fontSize: 11, bold: true, alignment: 'right' as const, color: primaryColor, border: [false, true, false, false] },
                ],
              ],
            },
            layout: 'noBorders',
          },
        ],
        margin: [0, 10, 0, 20],
      },
    ];

    // Notes
    const notesContent: Content[] = [];
    if (input.notes) {
      notesContent.push({
        stack: [
          { text: 'Catatan:', fontSize: 9, bold: true, color: '#666666', margin: [0, 0, 0, 3] },
          { text: input.notes, fontSize: 9, color: '#666666' },
        ],
        margin: [0, 0, 0, 20],
      });
    }

    // Signature
    const signatureContent: Content[] = [];
    if (input.config.signature_name) {
      signatureContent.push({
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            stack: [
              { text: '\n\n\n', fontSize: 9 },
              { text: input.config.signature_name, fontSize: 10, bold: true, alignment: 'center' as const },
              ...(input.config.signature_title
                ? [{ text: input.config.signature_title, fontSize: 9, color: '#666666', alignment: 'center' as const }]
                : []),
            ],
            alignment: 'center' as const,
          },
        ],
        margin: [0, 10, 0, 0],
      });
    }

    // Footer
    const footerText = input.footer_text || input.config.footer_text || '';

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
      },
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: '#ffffff',
          fillColor: primaryColor,
        },
      },
      content: [
        ...headerContent,
        {
          table: {
            headerRows: 1,
            widths: [30, '*', 40, 80, 80],
            body: [tableHeader, ...tableRows],
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: () => 0,
            hLineColor: (i: number) => i === 0 || i === 1 ? primaryColor : '#eeeeee',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
        ...summaryContent,
        ...notesContent,
        ...signatureContent,
      ],
      footer: footerText
        ? {
            text: footerText,
            alignment: 'center' as const,
            fontSize: 8,
            color: '#999999',
            margin: [40, 10, 40, 0],
          }
        : undefined,
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const writeStream = fs.createWriteStream(filepath);

    pdfDoc.pipe(writeStream);
    pdfDoc.end();

    writeStream.on('finish', () => {
      resolve(`/uploads/receipts/${filename}`);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}
