'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Handshake,
  Link2,
  Receipt,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  Loader2,
  Eye,
  Send,
  User,
  DollarSign,
  Clock,
  MousePointerClick,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmStore } from '@/stores/confirm.store';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DealDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string | null;
}

export function DealDetailDialog({ open, onOpenChange, dealId }: DealDetailDialogProps) {
  if (!dealId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DealDetailContent dealId={dealId} />
      </DialogContent>
    </Dialog>
  );
}

function DealDetailContent({ dealId }: { dealId: string }) {
  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal-detail', dealId],
    queryFn: async () => {
      const { data } = await api.get(`/deals/${dealId}`);
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deal) return null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          {deal.title}
        </DialogTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">{deal.deal_number}</Badge>
          <span>•</span>
          <Badge variant={deal.closed_status === 'WON' ? 'default' : deal.closed_status === 'LOST' ? 'destructive' : 'secondary'} className="text-xs">
            {deal.closed_status || deal.stage}
          </Badge>
          <span>•</span>
          <span className="font-medium">{formatCurrency(Number(deal.value))}</span>
        </div>
      </DialogHeader>

      <Tabs defaultValue="detail" className="mt-2">
        <TabsList className="w-full">
          <TabsTrigger value="detail" className="flex-1">
            <Handshake className="h-3.5 w-3.5 mr-1.5" />
            Detail
          </TabsTrigger>
          <TabsTrigger value="tracked-links" className="flex-1">
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Tracked Links
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex-1">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            Kwitansi
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex-1">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Pembayaran
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Kontak</p>
                <p className="font-medium">{deal.contact?.name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Nilai</p>
                <p className="font-medium">{formatCurrency(Number(deal.value))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Dibuat</p>
                <p className="font-medium">{formatDate(deal.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Assigned</p>
                <p className="font-medium">{deal.assigned_to?.name || '-'}</p>
              </div>
            </div>
          </div>
          {deal.products && deal.products.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Produk</p>
              <div className="space-y-1">
                {deal.products.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm border rounded px-2 py-1">
                    <span>{p.name} (x{p.qty})</span>
                    <span className="font-medium">{formatCurrency(p.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracked-links" className="mt-3">
          <TrackedLinksTab dealId={dealId} />
        </TabsContent>

        <TabsContent value="receipts" className="mt-3">
          <DealReceiptsTab dealId={dealId} />
        </TabsContent>

        <TabsContent value="payment" className="mt-3">
          <MidtransPaymentTab dealId={dealId} deal={deal} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ─── Tracked Links Tab ─── */
function TrackedLinksTab({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [showCreate, setShowCreate] = useState(false);
  const [linkForm, setLinkForm] = useState({ original_url: '', label: '' });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['tracked-links', dealId],
    queryFn: async () => {
      const { data } = await api.get(`/tracked-links?deal_id=${dealId}&limit=50`);
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      await api.post('/tracked-links', { ...input, deal_id: dealId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-links', dealId] });
      setShowCreate(false);
      setLinkForm({ original_url: '', label: '' });
      toast.success('Tracked link berhasil dibuat');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat tracked link');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tracked-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked-links', dealId] });
      toast.success('Tracked link dihapus');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menghapus');
    },
  });

  const copyLink = (code: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    navigator.clipboard.writeText(`${baseUrl}/t/${code}`);
    toast.success('Link disalin ke clipboard');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {links.length} tracked link{links.length !== 1 && 's'}
        </p>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Buat Link
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">URL Tujuan *</Label>
              <Input
                placeholder="https://payment.example.com/checkout"
                value={linkForm.original_url}
                onChange={(e) => setLinkForm({ ...linkForm, original_url: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Label (opsional)</Label>
              <Input
                placeholder="Link Pembayaran Paket A"
                value={linkForm.label}
                onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createMutation.mutate(linkForm)}
                disabled={!linkForm.original_url || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Simpan
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Belum ada tracked link untuk deal ini
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => (
            <Card key={link.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{link.label || link.original_url}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{link.tracking_code}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        {link.click_count} klik
                      </span>
                      {link.is_converted && (
                        <Badge variant="default" className="text-[10px] h-4 bg-emerald-500">Converted</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(link.tracking_code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={link.original_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => openConfirm({
                        title: 'Hapus Tracked Link?',
                        description: 'Link yang dihapus tidak bisa dikembalikan.',
                        onConfirm: () => deleteMutation.mutate(link.id),
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Deal Receipts Tab ─── */
function DealReceiptsTab({ dealId }: { dealId: string }) {
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['deal-receipts', dealId],
    queryFn: async () => {
      const { data } = await api.get(`/receipts?deal_id=${dealId}&limit=50`);
      return data.data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/receipts/${id}/send`);
    },
    onSuccess: () => {
      toast.success('Kwitansi dikirim via WA');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengirim kwitansi');
    },
  });

  const handleViewPdf = (pdfUrl: string | null) => {
    if (!pdfUrl) { toast.error('PDF belum tersedia'); return; }
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.open(`${baseUrl}${pdfUrl}`, '_blank');
  };

  const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    DRAFT: { label: 'Draft', variant: 'secondary' },
    SENT: { label: 'Terkirim', variant: 'default' },
    FAILED: { label: 'Gagal', variant: 'destructive' },
    VOIDED: { label: 'Dibatalkan', variant: 'outline' },
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Belum ada kwitansi untuk deal ini
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {receipts.map((r: any) => {
        const st = STATUS_MAP[r.status] || { label: r.status, variant: 'outline' as const };
        return (
          <Card key={r.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono">{r.receipt_number}</p>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.recipient_name} • {formatCurrency(Number(r.total_amount))} • {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewPdf(r.pdf_url)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {r.status === 'DRAFT' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => sendMutation.mutate(r.id)}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Midtrans Payment Tab ─── */

const PAYMENT_STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  settlement: { label: 'Lunas', icon: CheckCircle2, color: 'text-emerald-600' },
  capture: { label: 'Captured', icon: CheckCircle2, color: 'text-emerald-600' },
  pending: { label: 'Menunggu Pembayaran', icon: Timer, color: 'text-amber-600' },
  expire: { label: 'Kedaluwarsa', icon: XCircle, color: 'text-gray-500' },
  cancel: { label: 'Dibatalkan', icon: XCircle, color: 'text-red-500' },
  deny: { label: 'Ditolak', icon: AlertTriangle, color: 'text-red-600' },
  refund: { label: 'Refund', icon: RefreshCw, color: 'text-blue-500' },
  partial_refund: { label: 'Refund Sebagian', icon: RefreshCw, color: 'text-blue-500' },
};

function MidtransPaymentTab({ dealId, deal }: { dealId: string; deal: any }) {
  const queryClient = useQueryClient();

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/deals/${dealId}/payment-link`);
      return data.data as { snap_token: string; snap_url: string; order_id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-detail', dealId] });
      toast.success('Link pembayaran berhasil dibuat');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat link pembayaran');
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/deals/${dealId}/payment-status`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-detail', dealId] });
      toast.success('Status pembayaran diperbarui');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal cek status');
    },
  });

  const paymentStatus = deal.payment_status;
  const snapUrl = deal.midtrans_snap_url;
  const orderId = deal.midtrans_order_id;
  const paymentType = deal.midtrans_payment_type;
  const dealValue = Number(deal.value);

  const statusInfo = paymentStatus ? PAYMENT_STATUS_MAP[paymentStatus] : null;
  const StatusIcon = statusInfo?.icon || CreditCard;

  const canCreateLink = !paymentStatus || paymentStatus === 'expire' || paymentStatus === 'cancel' || paymentStatus === 'deny';
  const hasActiveLink = snapUrl && (paymentStatus === 'pending' || !paymentStatus);

  const copySnapUrl = () => {
    if (!snapUrl) return;
    navigator.clipboard.writeText(snapUrl);
    toast.success('Link pembayaran disalin ke clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Payment Status Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${statusInfo ? 'bg-muted' : 'bg-muted/50'}`}>
                <StatusIcon className={`h-5 w-5 ${statusInfo?.color || 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {statusInfo?.label || 'Belum ada pembayaran'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {orderId ? `Order: ${orderId}` : 'Buat link pembayaran Midtrans untuk deal ini'}
                </p>
              </div>
            </div>
            {paymentStatus && (
              <Badge
                variant={paymentStatus === 'settlement' || paymentStatus === 'capture' ? 'default' : 'secondary'}
                className={`text-xs ${paymentStatus === 'settlement' || paymentStatus === 'capture' ? 'bg-emerald-500' : ''}`}
              >
                {statusInfo?.label || paymentStatus}
              </Badge>
            )}
          </div>

          {/* Payment details */}
          {paymentType && (
            <div className="mt-3 pt-3 border-t text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metode Pembayaran</span>
                <span className="font-medium capitalize">{paymentType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Jumlah</span>
                <span className="font-medium">{formatCurrency(dealValue)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Payment Link */}
      {hasActiveLink && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Link Pembayaran Aktif</p>
            <div className="flex items-center gap-2">
              <Input
                value={snapUrl}
                readOnly
                className="text-xs font-mono bg-white"
              />
              <Button variant="outline" size="icon" className="shrink-0" onClick={copySnapUrl}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="shrink-0" asChild>
                <a href={snapUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Kirim link ini ke customer untuk melakukan pembayaran via Midtrans.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {canCreateLink && dealValue > 0 && (
          <Button
            onClick={() => createLinkMutation.mutate()}
            disabled={createLinkMutation.isPending}
            className="flex-1"
          >
            {createLinkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            {snapUrl && (paymentStatus === 'expire' || paymentStatus === 'cancel' || paymentStatus === 'deny')
              ? 'Buat Link Baru'
              : 'Buat Link Pembayaran'}
          </Button>
        )}

        {orderId && (
          <Button
            variant="outline"
            onClick={() => checkStatusMutation.mutate()}
            disabled={checkStatusMutation.isPending}
          >
            {checkStatusMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Cek Status
          </Button>
        )}
      </div>

      {/* Warning if no value */}
      {dealValue <= 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>Deal harus memiliki nilai (value) lebih dari 0 untuk membuat link pembayaran.</p>
        </div>
      )}
    </div>
  );
}
