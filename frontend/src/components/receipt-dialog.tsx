'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

interface ReceiptFormData {
  type: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  deal_id: string;
  items: ReceiptItem[];
  tax_amount: number;
  currency: string;
  payment_method: string;
  payment_ref: string;
  notes: string;
  footer_text: string;
}

const EMPTY_ITEM: ReceiptItem = { name: '', qty: 1, price: 0, subtotal: 0 };

const INITIAL_FORM: ReceiptFormData = {
  type: 'invoice',
  recipient_name: '',
  recipient_phone: '',
  recipient_email: '',
  deal_id: '',
  items: [{ ...EMPTY_ITEM }],
  tax_amount: 0,
  currency: 'IDR',
  payment_method: '',
  payment_ref: '',
  notes: '',
  footer_text: '',
};

const RECEIPT_TYPES = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'donation', label: 'Kwitansi Donasi' },
  { key: 'zakat', label: 'Kwitansi Zakat' },
  { key: 'service', label: 'Kwitansi Layanan' },
  { key: 'custom', label: 'Custom' },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any | null;
}

export function ReceiptDialog({ open, onOpenChange, editData }: ReceiptDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!editData;
  const [form, setForm] = useState<ReceiptFormData>(INITIAL_FORM);

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-receipt'],
    queryFn: async () => {
      const { data } = await api.get('/deals?limit=200');
      return data.data as { id: string; title: string; deal_number: string }[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        type: editData.type || 'invoice',
        recipient_name: editData.recipient_name || '',
        recipient_phone: editData.recipient_phone || '',
        recipient_email: editData.recipient_email || '',
        deal_id: editData.deal_id || '',
        items: editData.items?.length ? editData.items : [{ ...EMPTY_ITEM }],
        tax_amount: Number(editData.tax_amount) || 0,
        currency: editData.currency || 'IDR',
        payment_method: editData.payment_method || '',
        payment_ref: editData.payment_ref || '',
        notes: editData.notes || '',
        footer_text: editData.footer_text || '',
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [open, editData]);

  const subtotal = form.items.reduce((sum, it) => sum + it.subtotal, 0);
  const totalAmount = subtotal + form.tax_amount;

  const updateItem = (idx: number, field: keyof ReceiptItem, value: string | number) => {
    setForm((prev) => {
      const items = [...prev.items];
      const item = { ...items[idx], [field]: value };
      if (field === 'qty' || field === 'price') {
        item.subtotal = Number(item.qty) * Number(item.price);
      }
      items[idx] = item;
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  };

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post('/receipts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipts-summary'] });
      onOpenChange(false);
      toast.success('Kwitansi berhasil dibuat');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat kwitansi');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.patch(`/receipts/${editData.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipts-summary'] });
      onOpenChange(false);
      toast.success('Kwitansi berhasil diperbarui');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal memperbarui kwitansi');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipient_name.trim()) {
      toast.error('Nama penerima wajib diisi');
      return;
    }
    if (form.items.some((it) => !it.name.trim())) {
      toast.error('Nama item tidak boleh kosong');
      return;
    }

    const payload: any = {
      type: form.type,
      recipient_name: form.recipient_name.trim(),
      items: form.items.map((it) => ({
        name: it.name.trim(),
        qty: Number(it.qty),
        price: Number(it.price),
        subtotal: Number(it.qty) * Number(it.price),
      })),
      subtotal,
      tax_amount: form.tax_amount,
      total_amount: totalAmount,
      currency: form.currency,
    };

    if (form.recipient_phone) payload.recipient_phone = form.recipient_phone;
    if (form.recipient_email) payload.recipient_email = form.recipient_email;
    if (form.deal_id) payload.deal_id = form.deal_id;
    if (form.payment_method) payload.payment_method = form.payment_method;
    if (form.payment_ref) payload.payment_ref = form.payment_ref;
    if (form.notes) payload.notes = form.notes;
    if (form.footer_text) payload.footer_text = form.footer_text;

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Kwitansi' : 'Buat Kwitansi Baru'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type & Deal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipe Kwitansi</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIPT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deal (opsional)</Label>
              <Select value={form.deal_id || '_none'} onValueChange={(v) => setForm({ ...form, deal_id: v === '_none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Tanpa deal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Tanpa deal</SelectItem>
                  {deals.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.deal_number} — {d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Penerima</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nama *</Label>
                <Input
                  placeholder="John Doe"
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">No. HP</Label>
                <Input
                  placeholder="6281234567890"
                  value={form.recipient_phone}
                  onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="john@email.com"
                  value={form.recipient_email}
                  onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Item</h4>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah Item
              </Button>
            </div>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_70px_120px_120px_36px] gap-2 text-xs text-muted-foreground font-medium px-1">
                <span>Nama</span>
                <span>Qty</span>
                <span>Harga</span>
                <span>Subtotal</span>
                <span />
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_70px_120px_120px_36px] gap-2 items-center">
                  <Input
                    placeholder="Nama item"
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    required
                  />
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(e) => updateItem(idx, 'price', Number(e.target.value))}
                  />
                  <div className="text-sm font-medium text-right pr-2">
                    {formatNumber(item.qty * item.price)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={form.items.length <= 1}
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 border-t pt-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium w-32 text-right">{formatNumber(subtotal)}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Pajak</span>
              <Input
                type="number"
                min={0}
                className="w-32 text-right h-8"
                value={form.tax_amount}
                onChange={(e) => setForm({ ...form, tax_amount: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-4 text-sm font-bold border-t pt-2 mt-1">
              <span>Total</span>
              <span className="w-32 text-right">{formatNumber(totalAmount)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Metode Pembayaran</Label>
              <Input
                placeholder="Transfer Bank, QRIS, dll"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ref. Pembayaran</Label>
              <Input
                placeholder="No. transaksi"
                value={form.payment_ref}
                onChange={(e) => setForm({ ...form, payment_ref: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Catatan</Label>
            <Textarea
              placeholder="Catatan tambahan..."
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Simpan Perubahan' : 'Buat Kwitansi'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
