'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CreditCard,
  Shield,
  Loader2,
  ExternalLink,
  Upload,
  FileText,
  ArrowUpRight,
  Copy,
  CheckCircle2,
  Clock,
  ImageIcon,
  X,
  Ban,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface Invoice {
  id: string;
  invoice_number: string;
  plan_id: string;
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
  plan: { name: string; plan_code: string };
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PAID: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu Pembayaran',
  PAID: 'Bukti Dikirim',
  VERIFIED: 'Terverifikasi',
  EXPIRED: 'Kedaluwarsa',
  CANCELLED: 'Dibatalkan',
  REFUNDED: 'Dikembalikan',
};

/** Resolve relative /uploads/ paths to backend origin */
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
function resolveProofUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND_ORIGIN}${url}`;
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [uploadInvoice, setUploadInvoice] = useState<Invoice | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [changePlanInvoice, setChangePlanInvoice] = useState<Invoice | null>(null);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState<string>('');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: async () => {
      const { data } = await api.get('/invoices');
      return (data.data || []) as Invoice[];
    },
  });

  const { data: paymentInfo } = useQuery({
    queryKey: ['payment-info'],
    queryFn: async () => {
      const { data } = await api.get('/payment-settings/public');
      return data.data as { bank_accounts: BankAccount[]; midtrans_enabled: boolean };
    },
  });

  const uploadProofMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.patch(`/invoices/${id}/proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
      setUploadInvoice(null);
      resetProof();
      toast.success('Bukti pembayaran berhasil diunggah! Menunggu verifikasi admin.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengunggah bukti');
    },
  });

  // Fetch plans when change-plan dialog is open
  const { data: plans = [] } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const { data } = await api.get('/pricing/plans');
      return (data.data || []) as { id: string; plan_code: string; name: string; price: number; billing_cycle: string }[];
    },
    enabled: !!changePlanInvoice,
    staleTime: 60_000,
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ invoiceId, planId }: { invoiceId: string; planId: string }) => {
      await api.patch(`/invoices/${invoiceId}/change-plan`, { plan_id: planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
      setChangePlanInvoice(null);
      setSelectedNewPlanId('');
      toast.success('Paket invoice berhasil diubah');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengubah paket');
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await api.patch(`/invoices/${invoiceId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
      toast.success('Invoice berhasil dibatalkan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membatalkan invoice');
    },
  });

  const resetProof = () => {
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB');
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Disalin ke clipboard');
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const currentPlan = user?.organization?.plan || 'FREE';
  const pendingInvoice = invoices.find((inv) => inv.status === 'PENDING');
  const bankAccounts = paymentInfo?.bank_accounts || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Billing & Langganan</h1>
        <p className="text-sm text-muted-foreground">Kelola langganan dan pembayaran Anda</p>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Paket Saat Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{currentPlan}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentPlan === 'FREE'
                  ? 'Paket gratis dengan fitur terbatas'
                  : 'Nikmati fitur lengkap sesuai paket Anda'}
              </p>
            </div>
            <Link href="/dashboard/pricing">
              <Button variant="outline">
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Lihat Paket Lain
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Pending Payment Alert */}
      {pendingInvoice && (
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Menunggu Pembayaran</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Invoice <span className="font-mono font-medium">{pendingInvoice.invoice_number}</span> —{' '}
                    {formatRupiah(pendingInvoice.amount)} (Paket {pendingInvoice.plan?.plan_code})
                  </p>
                  {pendingInvoice.expired_at && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      Batas pembayaran: {formatDate(pendingInvoice.expired_at)}
                    </p>
                  )}
                </div>

                {/* Bank Account Info */}
                {bankAccounts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Transfer ke salah satu rekening berikut:</p>
                    {bankAccounts.map((bank) => (
                      <div key={bank.id} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg border p-3">
                        <div>
                          <p className="font-semibold text-sm">{bank.bank_name}</p>
                          <p className="font-mono text-sm">{bank.account_number}</p>
                          <p className="text-xs text-muted-foreground">a.n. {bank.account_holder}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => copyToClipboard(bank.account_number)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Salin
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment Steps */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Langkah Pembayaran:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                    <li>Transfer sesuai jumlah tagihan ke salah satu rekening di atas</li>
                    <li>Simpan/screenshot bukti transfer Anda</li>
                    <li>Klik tombol &quot;Upload Bukti&quot; pada invoice di bawah</li>
                    <li>Upload foto/screenshot bukti transfer</li>
                    <li>Tunggu verifikasi admin (maks 1x24 jam kerja)</li>
                  </ol>
                </div>

                <Button
                  size="sm"
                  onClick={() => { setUploadInvoice(pendingInvoice); resetProof(); }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Bukti Pembayaran
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Riwayat Invoice
          </CardTitle>
          <CardDescription>Daftar invoice dan status pembayaran</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada invoice.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
                      <Badge variant="outline" className="text-[10px]">{inv.plan?.plan_code}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatRupiah(inv.amount)}</span>
                      <span>{formatDate(inv.created_at)}</span>
                      {inv.expired_at && inv.status === 'PENDING' && (
                        <span className="text-amber-600">Batas: {formatDate(inv.expired_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[inv.status] || ''}`}>
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                    {inv.status === 'VERIFIED' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {inv.payment_proof_url && (
                      <a href={resolveProofUrl(inv.payment_proof_url)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Lihat bukti">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    {inv.status === 'PENDING' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => { setChangePlanInvoice(inv); setSelectedNewPlanId(''); }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Ubah Paket
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          disabled={cancelInvoiceMutation.isPending}
                          onClick={() => {
                            if (confirm('Yakin ingin membatalkan invoice ini?')) {
                              cancelInvoiceMutation.mutate(inv.id);
                            }
                          }}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Batalkan
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => { setUploadInvoice(inv); resetProof(); }}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Upload Bukti
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanInvoice} onOpenChange={(open) => { if (!open) { setChangePlanInvoice(null); setSelectedNewPlanId(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Paket Invoice</DialogTitle>
          </DialogHeader>
          {changePlanInvoice && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Invoice saat ini:</p>
                <p className="font-mono text-sm font-medium">{changePlanInvoice.invoice_number}</p>
                <p className="text-sm">
                  Paket <strong>{changePlanInvoice.plan?.name || changePlanInvoice.plan?.plan_code}</strong> — {formatRupiah(changePlanInvoice.amount)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Pilih Paket Baru:</Label>
                <div className="space-y-2">
                  {plans
                    .filter((p) => p.id !== changePlanInvoice.plan_id && p.price > 0)
                    .map((p) => (
                      <div
                        key={p.id}
                        className={`rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                          selectedNewPlanId === p.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                        onClick={() => setSelectedNewPlanId(p.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            selectedNewPlanId === p.id ? 'border-primary' : 'border-muted-foreground/40'
                          }`}>
                            {selectedNewPlanId === p.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.billing_cycle === 'YEARLY' ? 'Per tahun' : 'Per bulan'}</p>
                            </div>
                            <p className="font-bold text-sm">{formatRupiah(p.price)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  {plans.filter((p) => p.id !== changePlanInvoice.plan_id && p.price > 0).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Tidak ada paket lain tersedia</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setChangePlanInvoice(null); setSelectedNewPlanId(''); }}>Batal</Button>
                <Button
                  onClick={() => selectedNewPlanId && changePlanMutation.mutate({ invoiceId: changePlanInvoice.id, planId: selectedNewPlanId })}
                  disabled={!selectedNewPlanId || changePlanMutation.isPending}
                >
                  {changePlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Ubah Paket
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Proof Dialog */}
      <Dialog open={!!uploadInvoice} onOpenChange={(open) => { if (!open) { setUploadInvoice(null); resetProof(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          {uploadInvoice && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm">
                  Invoice: <span className="font-mono font-medium">{uploadInvoice.invoice_number}</span>
                </p>
                <p className="text-sm font-semibold">{formatRupiah(uploadInvoice.amount)}</p>
                <p className="text-xs text-muted-foreground">Paket {uploadInvoice.plan?.plan_code}</p>
              </div>

              {/* Bank info in dialog */}
              {bankAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Transfer ke:</Label>
                  {bankAccounts.map((bank) => (
                    <div key={bank.id} className="flex items-center justify-between bg-muted/30 rounded-lg border p-2.5 text-sm">
                      <div>
                        <span className="font-semibold">{bank.bank_name}</span>{' '}
                        <span className="font-mono">{bank.account_number}</span>
                        <p className="text-xs text-muted-foreground">a.n. {bank.account_holder}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(bank.account_number)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Image upload area */}
              <div className="space-y-2">
                <Label>Foto Bukti Transfer</Label>
                {proofPreview ? (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img src={proofPreview} alt="Preview" className="max-h-48 w-full object-contain bg-muted/30" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={resetProof}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Klik untuk pilih gambar</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, atau WEBP (maks 10MB)</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setUploadInvoice(null); resetProof(); }}>Batal</Button>
                <Button
                  onClick={() => proofFile && uploadProofMutation.mutate({ id: uploadInvoice.id, file: proofFile })}
                  disabled={!proofFile || uploadProofMutation.isPending}
                >
                  {uploadProofMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Kirim Bukti
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
