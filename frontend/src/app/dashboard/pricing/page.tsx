'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Check, X, ArrowLeft, Landmark, CreditCard, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface PlanFeatures {
  [key: string]: boolean;
}

interface Plan {
  id: string;
  plan_code: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  max_users: number;
  max_contacts: number;
  max_wa_instances: number;
  max_templates: number;
  max_broadcasts_per_month: number;
  max_recipients_per_broadcast: number;
  max_scheduled_messages: number;
  max_deals: number;
  max_tags: number;
  max_webhook_configs: number;
  daily_message_limit: number;
  max_import_batch_size: number;
  max_storage_mb: number;
  analytics_max_days: number;
  features: PlanFeatures;
}

const FEATURE_LABELS: Record<string, string> = {
  broadcast: 'Broadcast Massal',
  scheduledMessages: 'Pesan Terjadwal',
  deals: 'Deals / Pipeline',
  closingReport: 'Closing Report',
  autoResponseNewChat: 'Auto-Response Chat Baru',
  autoResponseOutsideHours: 'Auto-Response Luar Jam',
  webhookConfigs: 'Webhook Config',
  webhookAutoReply: 'Webhook Auto-Reply',
  teamManagement: 'Manajemen Tim',
  assignConversation: 'Assign Percakapan',
  conversationLabels: 'Label Percakapan',
  conversationPriority: 'Prioritas Percakapan',
  contactImport: 'Import Kontak',
  contactCustomFields: 'Custom Fields',
  editMessage: 'Edit Pesan',
  analyticsMessageVolume: 'Analytics Volume',
  analyticsAgentPerformance: 'Analytics Agen',
  analyticsContactGrowth: 'Analytics Kontak',
  apiAccess: 'Akses API',
  scheduleBroadcast: 'Jadwal Broadcast',
  broadcastMedia: 'Broadcast Media',
};

const QUOTA_LABELS: { key: string; label: string; suffix?: string }[] = [
  { key: 'max_users', label: 'Pengguna' },
  { key: 'max_contacts', label: 'Kontak' },
  { key: 'max_wa_instances', label: 'Instansi WA' },
  { key: 'max_broadcasts_per_month', label: 'Broadcast/Bulan' },
  { key: 'daily_message_limit', label: 'Pesan/Hari' },
  { key: 'max_storage_mb', label: 'Storage', suffix: 'MB' },
];

export default function PricingPage() {
  const user = useAuthStore((s) => s.user);
  const currentPlan = user?.organization?.plan || 'FREE';
  const router = useRouter();
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  // Payment modal state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentStep, setPaymentStep] = useState<'method' | 'confirm' | 'success'>('method');
  const [paymentMethod, setPaymentMethod] = useState<'manual_transfer' | 'midtrans'>('manual_transfer');
  const [createdInvoice, setCreatedInvoice] = useState<{ invoice_number: string; amount: number; expired_at: string } | null>(null);
  const [waPhone, setWaPhone] = useState(user?.phone || '');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const { data } = await api.get('/pricing/plans');
      return (data.data || []) as Plan[];
    },
    staleTime: 60_000,
  });

  // Fetch bank accounts + midtrans status for payment modal
  const { data: paymentInfo } = useQuery({
    queryKey: ['payment-info'],
    queryFn: async () => {
      const { data } = await api.get('/payment-settings/public');
      return data.data as { bank_accounts: { id: string; bank_name: string; account_number: string; account_holder: string }[]; midtrans_enabled: boolean };
    },
    staleTime: 60_000,
  });

  const bankAccounts = paymentInfo?.bank_accounts || [];
  const midtransEnabled = paymentInfo?.midtrans_enabled || false;

  const openPaymentModal = (plan: Plan) => {
    setSelectedPlan(plan);
    setPaymentStep('method');
    setPaymentMethod('manual_transfer');
    setCreatedInvoice(null);
  };

  const closePaymentModal = () => {
    setSelectedPlan(null);
    if (createdInvoice) {
      // If invoice was created, navigate to billing
      router.push('/dashboard/billing');
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;
    setUpgradingPlanId(selectedPlan.id);
    try {
      const { data } = await api.post('/invoices/request-upgrade', { plan_id: selectedPlan.id, phone: waPhone.trim() });
      const inv = data.data;
      setCreatedInvoice({
        invoice_number: inv.invoice_number,
        amount: inv.amount,
        expired_at: inv.expired_at,
      });
      setPaymentStep('success');
      toast.success('Invoice berhasil dibuat!');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat invoice upgrade');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Disalin ke clipboard');
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const formatQuota = (v: number, suffix?: string) => {
    if (v === -1) return 'Unlimited';
    if (v === 0) return '-';
    return suffix ? `${v.toLocaleString('id-ID')} ${suffix}` : v.toLocaleString('id-ID');
  };

  // Gather all unique feature keys from all plans
  const allFeatureKeys = Array.from(
    new Set(plans.flatMap((p) => Object.keys(p.features)))
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/billing">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Pilih Paket</h1>
          <p className="text-sm text-muted-foreground">Bandingkan fitur dan pilih paket yang sesuai kebutuhan Anda</p>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.plan_code === currentPlan;
          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary ring-2 ring-primary/20' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge className="text-[10px]">Paket Anda</Badge>}
                </div>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{plan.price === 0 ? 'Gratis' : formatRupiah(plan.price)}</span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">/{plan.billing_cycle === 'MONTHLY' ? 'bulan' : plan.billing_cycle === 'YEARLY' ? 'tahun' : plan.billing_cycle}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quotas */}
                <div className="space-y-2">
                  {QUOTA_LABELS.map(({ key, label, suffix }) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{formatQuota((plan as any)[key], suffix)}</span>
                    </div>
                  ))}
                </div>

                {/* Features snippet */}
                <div className="border-t pt-3 space-y-1.5">
                  {allFeatureKeys.slice(0, 6).map((key) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {plan.features[key] ? (
                        <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={plan.features[key] ? '' : 'text-muted-foreground/60'}>
                        {FEATURE_LABELS[key] || key}
                      </span>
                    </div>
                  ))}
                  {allFeatureKeys.length > 6 && (
                    <p className="text-[10px] text-muted-foreground pt-1">
                      +{allFeatureKeys.length - 6} fitur lainnya (lihat tabel di bawah)
                    </p>
                  )}
                </div>

                {/* CTA */}
                <div className="pt-2">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Paket Saat Ini
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.price === 0 ? 'outline' : 'default'}
                      disabled={upgradingPlanId === plan.id}
                      onClick={() => openPaymentModal(plan)}
                    >
                      {upgradingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {plan.price === 0 ? 'Downgrade' : 'Pilih Paket'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perbandingan Fitur Lengkap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Fitur</th>
                    {plans.map((p) => (
                      <th key={p.id} className="text-center p-2 font-medium">{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allFeatureKeys.map((key) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground">{FEATURE_LABELS[key] || key}</td>
                      {plans.map((p) => (
                        <td key={p.id} className="text-center p-2">
                          {p.features[key] ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== PAYMENT PROCESS MODAL ==================== */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => { if (!open) closePaymentModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {paymentStep === 'success' ? 'Invoice Berhasil Dibuat!' : `Upgrade ke ${selectedPlan?.name}`}
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && paymentStep === 'method' && (
            <div className="space-y-5">
              {/* Plan summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="font-semibold">{selectedPlan.name}</p>
                <p className="text-2xl font-bold">{formatRupiah(selectedPlan.price)}<span className="text-sm font-normal text-muted-foreground">/{selectedPlan.billing_cycle === 'YEARLY' ? 'tahun' : 'bulan'}</span></p>
                <p className="text-xs text-muted-foreground">{selectedPlan.description}</p>
              </div>

              {/* Payment method selection */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Pilih Metode Pembayaran:</p>

                {/* Manual Transfer */}
                <div
                  className={`rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                    paymentMethod === 'manual_transfer'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setPaymentMethod('manual_transfer')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === 'manual_transfer' ? 'border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {paymentMethod === 'manual_transfer' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <Landmark className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Transfer Bank Manual</p>
                      <p className="text-xs text-muted-foreground">Transfer ke rekening bank, lalu upload bukti pembayaran</p>
                    </div>
                  </div>
                </div>

                {/* Midtrans */}
                <div
                  className={`rounded-lg border-2 p-4 transition-colors ${
                    midtransEnabled
                      ? `cursor-pointer ${paymentMethod === 'midtrans' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`
                      : 'border-muted opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => midtransEnabled && setPaymentMethod('midtrans')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === 'midtrans' ? 'border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {paymentMethod === 'midtrans' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Payment Gateway (Midtrans)</p>
                      <p className="text-xs text-muted-foreground">
                        {midtransEnabled ? 'Bayar otomatis via VA, QRIS, e-Wallet, dll.' : 'Belum tersedia — segera hadir'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closePaymentModal}>Batal</Button>
                <Button onClick={() => setPaymentStep('confirm')}>
                  Lanjutkan
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {selectedPlan && paymentStep === 'confirm' && (
            <div className="space-y-5">
              {/* WhatsApp number input */}
              <div className="space-y-2">
                <Label htmlFor="wa-phone" className="text-sm font-medium">
                  Nomor WhatsApp <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wa-phone"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="Contoh: 628123456789"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Instruksi pembayaran akan dikirim ke nomor ini via WhatsApp
                </p>
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paket</span>
                  <span className="font-medium">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Harga</span>
                  <span className="font-bold text-lg">{formatRupiah(selectedPlan.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Metode</span>
                  <span className="font-medium">{paymentMethod === 'manual_transfer' ? 'Transfer Bank Manual' : 'Midtrans'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Periode</span>
                  <span className="font-medium">1 {selectedPlan.billing_cycle === 'YEARLY' ? 'Tahun' : 'Bulan'}</span>
                </div>
              </div>

              {/* Bank accounts (for manual transfer) */}
              {paymentMethod === 'manual_transfer' && bankAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Transfer ke salah satu rekening berikut:</p>
                  {bankAccounts.map((bank) => (
                    <div key={bank.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-semibold text-sm">{bank.bank_name}</p>
                        <p className="font-mono text-sm">{bank.account_number}</p>
                        <p className="text-xs text-muted-foreground">a.n. {bank.account_holder}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => copyToClipboard(bank.account_number)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Salin
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment instructions */}
              {paymentMethod === 'manual_transfer' && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Cara Pembayaran:</p>
                  <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-decimal pl-4">
                    <li>Klik &quot;Konfirmasi &amp; Buat Invoice&quot; di bawah</li>
                    <li>Transfer sesuai jumlah tagihan ({formatRupiah(selectedPlan.price)}) ke salah satu rekening di atas</li>
                    <li>Simpan/screenshot bukti transfer Anda</li>
                    <li>Buka halaman <strong>Billing</strong>, klik &quot;Upload Bukti&quot; pada invoice</li>
                    <li>Upload foto bukti transfer, tunggu verifikasi admin (maks 1x24 jam)</li>
                  </ol>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setPaymentStep('method')}>
                  Kembali
                </Button>
                <Button onClick={handleConfirmUpgrade} disabled={!!upgradingPlanId || !waPhone.trim()}>
                  {upgradingPlanId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Konfirmasi &amp; Buat Invoice
                </Button>
              </div>
            </div>
          )}

          {selectedPlan && paymentStep === 'success' && createdInvoice && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="text-lg font-semibold">Invoice Berhasil Dibuat!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Silakan lakukan pembayaran sebelum batas waktu
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">No. Invoice</span>
                  <span className="font-mono font-medium">{createdInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paket</span>
                  <span className="font-medium">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Bayar</span>
                  <span className="font-bold text-lg">{formatRupiah(createdInvoice.amount)}</span>
                </div>
                {createdInvoice.expired_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Batas Bayar</span>
                    <span className="text-amber-600 font-medium">{new Date(createdInvoice.expired_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
              </div>

              {/* Bank accounts recap */}
              {paymentMethod === 'manual_transfer' && bankAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Transfer ke:</p>
                  {bankAccounts.map((bank) => (
                    <div key={bank.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-semibold text-sm">{bank.bank_name}</p>
                        <p className="font-mono text-sm">{bank.account_number}</p>
                        <p className="text-xs text-muted-foreground">a.n. {bank.account_holder}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => copyToClipboard(bank.account_number)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Salin
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={() => { setSelectedPlan(null); router.push('/dashboard/billing'); }}>
                  Buka Halaman Billing
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
