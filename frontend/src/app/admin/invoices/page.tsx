'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { API_BASE_URL } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Eye, ChevronLeft, ChevronRight, ExternalLink, Plus, Loader2 } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_proof_url: string | null;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  expired_at: string | null;
  notes: string | null;
  created_at: string;
  organization: { id: string; name: string; slug: string };
  plan: { name: string; plan_code: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PAID: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUSES = ['PENDING', 'PAID', 'VERIFIED', 'EXPIRED', 'CANCELLED', 'REFUNDED'];

/** Resolve relative /uploads/ paths to backend origin */
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
function resolveProofUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND_ORIGIN}${url}`;
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ organization_id: '', plan_id: '', amount: 0, notes: '' });
  const [creating, setCreating] = useState(false);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; plan_code: string; price: number }[]>([]);

  const limit = 20;

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit };
    if (filterStatus !== 'all') params.status = filterStatus;

    api.get('/invoices/admin', { params })
      .then((res) => {
        setInvoices(res.data.data.invoices);
        setTotal(res.data.data.total);
      })
      .catch(() => toast.error('Gagal memuat data invoice'))
      .finally(() => setLoading(false));
  }, [page, filterStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Fetch orgs + plans when create dialog opens
  useEffect(() => {
    if (showCreate) {
      api.get('/admin/organizations').then((res) => setOrgs(res.data.data.organizations || [])).catch(() => {});
      api.get('/admin/plans').then((res) => setPlans(res.data.data || [])).catch(() => {});
    }
  }, [showCreate]);

  const handleCreate = async () => {
    if (!createForm.organization_id || !createForm.plan_id || createForm.amount <= 0) {
      toast.error('Lengkapi semua field');
      return;
    }
    setCreating(true);
    try {
      await api.post('/invoices/admin', createForm);
      toast.success('Invoice berhasil dibuat');
      setShowCreate(false);
      setCreateForm({ organization_id: '', plan_id: '', amount: 0, notes: '' });
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat invoice');
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (inv: Invoice) => {
    setActionLoading(inv.id);
    try {
      await api.patch(`/invoices/admin/${inv.id}/verify`);
      toast.success(`Invoice ${inv.invoice_number} terverifikasi — plan diaktifkan`);
      setDetailInvoice(null);
      fetchInvoices();
    } catch {
      toast.error('Gagal memverifikasi invoice');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (inv: Invoice) => {
    setActionLoading(inv.id);
    try {
      await api.patch(`/invoices/admin/${inv.id}/cancel`);
      toast.success(`Invoice ${inv.invoice_number} dibatalkan`);
      setDetailInvoice(null);
      fetchInvoices();
    } catch {
      toast.error('Gagal membatalkan invoice');
    } finally {
      setActionLoading('');
    }
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Invoice</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Invoice
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Semua Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-muted rounded" />)}
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Tidak ada invoice ditemukan.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Invoice</th>
                    <th className="p-3 font-medium">Organisasi</th>
                    <th className="p-3 font-medium">Plan</th>
                    <th className="p-3 font-medium">Jumlah</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Tanggal</th>
                    <th className="p-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="p-3">{inv.organization?.name || '-'}</td>
                      <td className="p-3"><Badge variant="outline" className="text-[10px]">{inv.plan?.plan_code || '-'}</Badge></td>
                      <td className="p-3 font-medium">{formatRupiah(inv.amount)}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || ''}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(inv.created_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailInvoice(inv)} title="Detail">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {inv.status === 'PAID' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleVerify(inv)}
                              disabled={actionLoading === inv.id}
                              title="Verifikasi"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {inv.status !== 'VERIFIED' && inv.status !== 'CANCELLED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCancel(inv)}
                              disabled={actionLoading === inv.id}
                              title="Batalkan"
                            >
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} invoice total</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Invoice Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organisasi</Label>
              <Select value={createForm.organization_id} onValueChange={(v) => setCreateForm({ ...createForm, organization_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih organisasi..." /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paket</Label>
              <Select value={createForm.plan_id} onValueChange={(v) => {
                const plan = plans.find((p) => p.id === v);
                setCreateForm({ ...createForm, plan_id: v, amount: plan?.price || 0 });
              }}>
                <SelectTrigger><SelectValue placeholder="Pilih paket..." /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.plan_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jumlah (Rp)</Label>
              <Input type="number" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Input value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Catatan tambahan..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Buat Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailInvoice} onOpenChange={(open) => !open && setDetailInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice {detailInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Organisasi:</span> {detailInvoice.organization?.name}</div>
                <div><span className="text-muted-foreground">Plan:</span> {detailInvoice.plan?.name} ({detailInvoice.plan?.plan_code})</div>
                <div><span className="text-muted-foreground">Jumlah:</span> {formatRupiah(detailInvoice.amount)}</div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailInvoice.status] || ''}`}>
                    {detailInvoice.status}
                  </span>
                </div>
                <div><span className="text-muted-foreground">Periode:</span> {formatDate(detailInvoice.period_start)} — {formatDate(detailInvoice.period_end)}</div>
                <div><span className="text-muted-foreground">Metode:</span> {detailInvoice.payment_method || '-'}</div>
                {detailInvoice.paid_at && (
                  <div><span className="text-muted-foreground">Dibayar:</span> {formatDate(detailInvoice.paid_at)}</div>
                )}
                {detailInvoice.expired_at && (
                  <div><span className="text-muted-foreground">Kedaluwarsa:</span> {formatDate(detailInvoice.expired_at)}</div>
                )}
                {detailInvoice.notes && (
                  <div className="col-span-2"><span className="text-muted-foreground">Catatan:</span> {detailInvoice.notes}</div>
                )}
              </div>

              {/* Payment proof */}
              {detailInvoice.payment_proof_url && (
                <div>
                  <Label className="text-xs text-muted-foreground">Bukti Pembayaran</Label>
                  <div className="mt-2 rounded-lg border overflow-hidden">
                    <img
                      src={resolveProofUrl(detailInvoice.payment_proof_url)}
                      alt="Bukti pembayaran"
                      className="max-h-64 w-full object-contain bg-muted/30"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <a
                    href={resolveProofUrl(detailInvoice.payment_proof_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka di Tab Baru
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                {detailInvoice.status === 'PAID' && (
                  <Button
                    onClick={() => handleVerify(detailInvoice)}
                    disabled={actionLoading === detailInvoice.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Verifikasi
                  </Button>
                )}
                {detailInvoice.status !== 'VERIFIED' && detailInvoice.status !== 'CANCELLED' && (
                  <Button
                    variant="destructive"
                    onClick={() => handleCancel(detailInvoice)}
                    disabled={actionLoading === detailInvoice.id}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Batalkan
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
