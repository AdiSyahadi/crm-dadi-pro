'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Landmark, CreditCard, Wallet, Save, Eye, EyeOff } from 'lucide-react';

// ======= Types =======
interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
  sort_order: number;
}

interface MidtransConfig {
  merchant_id: string;
  server_key: string;
  server_key_set: boolean;
  client_key: string;
  environment: string;
  is_enabled: boolean;
}

interface FlipConfig {
  secret_key: string;
  secret_key_set: boolean;
  validation_token: string;
  validation_token_set: boolean;
  environment: string;
  is_enabled: boolean;
}

// ======= Component =======
export default function AdminPaymentSettingsPage() {
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  // ---- Bank Accounts ----
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_number: '', account_holder: '', is_active: true, sort_order: 0 });
  const [bankSaving, setBankSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  // ---- Midtrans ----
  const [midtransConfig, setMidtransConfig] = useState<MidtransConfig | null>(null);
  const [midtransLoading, setMidtransLoading] = useState(true);
  const [midtransForm, setMidtransForm] = useState({ merchant_id: '', server_key: '', client_key: '', environment: 'sandbox', is_enabled: false });
  const [midtransSaving, setMidtransSaving] = useState(false);
  const [showServerKey, setShowServerKey] = useState(false);

  // ---- Flip ----
  const [flipConfig, setFlipConfig] = useState<FlipConfig | null>(null);
  const [flipLoading, setFlipLoading] = useState(true);
  const [flipForm, setFlipForm] = useState({ secret_key: '', validation_token: '', environment: 'sandbox', is_enabled: false });
  const [flipSaving, setFlipSaving] = useState(false);
  const [showFlipSecret, setShowFlipSecret] = useState(false);
  const [showFlipToken, setShowFlipToken] = useState(false);

  // ---- Fetch Bank Accounts ----
  const fetchBanks = useCallback(() => {
    setBanksLoading(true);
    api.get('/payment-settings/banks')
      .then((res) => setBanks(res.data.data || []))
      .catch(() => toast.error('Gagal memuat data rekening bank'))
      .finally(() => setBanksLoading(false));
  }, []);

  // ---- Fetch Midtrans ----
  const fetchMidtrans = useCallback(() => {
    setMidtransLoading(true);
    api.get('/payment-settings/midtrans')
      .then((res) => {
        const c = res.data.data;
        setMidtransConfig(c);
        setMidtransForm({
          merchant_id: c.merchant_id || '',
          server_key: '', // don't prefill server key for security
          client_key: c.client_key || '',
          environment: c.environment || 'sandbox',
          is_enabled: c.is_enabled || false,
        });
      })
      .catch(() => toast.error('Gagal memuat konfigurasi Midtrans'))
      .finally(() => setMidtransLoading(false));
  }, []);

  // ---- Fetch Flip ----
  const fetchFlip = useCallback(() => {
    setFlipLoading(true);
    api.get('/payment-settings/flip')
      .then((res) => {
        const c = res.data.data;
        setFlipConfig(c);
        setFlipForm({
          secret_key: '',
          validation_token: '',
          environment: c.environment || 'sandbox',
          is_enabled: c.is_enabled || false,
        });
      })
      .catch(() => toast.error('Gagal memuat konfigurasi Flip'))
      .finally(() => setFlipLoading(false));
  }, []);

  useEffect(() => { fetchBanks(); fetchMidtrans(); fetchFlip(); }, [fetchBanks, fetchMidtrans, fetchFlip]);

  // ---- Bank Dialog Handlers ----
  const openCreateBank = () => {
    setEditingBank(null);
    setBankForm({ bank_name: '', account_number: '', account_holder: '', is_active: true, sort_order: 0 });
    setShowBankDialog(true);
  };

  const openEditBank = (bank: BankAccount) => {
    setEditingBank(bank);
    setBankForm({
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_holder: bank.account_holder,
      is_active: bank.is_active,
      sort_order: bank.sort_order,
    });
    setShowBankDialog(true);
  };

  const handleSaveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_number.trim() || !bankForm.account_holder.trim()) {
      toast.error('Lengkapi semua field');
      return;
    }
    setBankSaving(true);
    try {
      if (editingBank) {
        await api.patch(`/payment-settings/banks/${editingBank.id}`, bankForm);
        toast.success('Rekening bank berhasil diperbarui');
      } else {
        await api.post('/payment-settings/banks', bankForm);
        toast.success('Rekening bank berhasil ditambahkan');
      }
      setShowBankDialog(false);
      fetchBanks();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan rekening bank');
    } finally {
      setBankSaving(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    openConfirm({ title: 'Hapus rekening bank ini?', description: 'Rekening bank akan dihapus dari daftar pembayaran.', onConfirm: () => { setDeletingId(id); executeDeleteBank(id); } });
  };

  const executeDeleteBank = async (id: string) => {
    try {
      await api.delete(`/payment-settings/banks/${id}`);
      toast.success('Rekening bank berhasil dihapus');
      fetchBanks();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal menghapus');
    } finally {
      setDeletingId('');
    }
  };

  // ---- Flip Handlers ----
  const handleSaveFlip = async () => {
    setFlipSaving(true);
    try {
      const payload: any = {
        environment: flipForm.environment,
        is_enabled: flipForm.is_enabled ? 'true' : 'false',
      };
      if (flipForm.secret_key.trim()) {
        payload.secret_key = flipForm.secret_key;
      }
      if (flipForm.validation_token.trim()) {
        payload.validation_token = flipForm.validation_token;
      }
      await api.put('/payment-settings/flip', payload);
      toast.success('Konfigurasi Flip berhasil disimpan');
      fetchFlip();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan konfigurasi Flip');
    } finally {
      setFlipSaving(false);
    }
  };

  // ---- Midtrans Handlers ----
  const handleSaveMidtrans = async () => {
    setMidtransSaving(true);
    try {
      const payload: any = {
        merchant_id: midtransForm.merchant_id,
        client_key: midtransForm.client_key,
        environment: midtransForm.environment,
        is_enabled: midtransForm.is_enabled ? 'true' : 'false',
      };
      if (midtransForm.server_key.trim()) {
        payload.server_key = midtransForm.server_key;
      }
      await api.put('/payment-settings/midtrans', payload);
      toast.success('Konfigurasi Midtrans berhasil disimpan');
      fetchMidtrans();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan konfigurasi Midtrans');
    } finally {
      setMidtransSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Pengaturan Pembayaran</h2>

      {/* ==================== BANK ACCOUNTS ==================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Rekening Bank
              </CardTitle>
              <CardDescription>Daftar rekening bank untuk pembayaran manual transfer</CardDescription>
            </div>
            <Button size="sm" onClick={openCreateBank}>
              <Plus className="h-4 w-4 mr-1" />
              Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {banksLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : banks.length === 0 ? (
            <div className="text-center py-8">
              <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada rekening bank.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{bank.bank_name}</span>
                      <Badge variant={bank.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {bank.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    <p className="text-sm font-mono">{bank.account_number}</p>
                    <p className="text-xs text-muted-foreground">a.n. {bank.account_holder}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBank(bank)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteBank(bank.id)}
                      disabled={deletingId === bank.id}
                      title="Hapus"
                    >
                      {deletingId === bank.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== MIDTRANS CONFIG ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Integrasi Midtrans
          </CardTitle>
          <CardDescription>Konfigurasi payment gateway Midtrans untuk pembayaran otomatis</CardDescription>
        </CardHeader>
        <CardContent>
          {midtransLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 max-w-lg">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Aktifkan Midtrans</Label>
                  <p className="text-xs text-muted-foreground">Aktifkan pembayaran otomatis via Midtrans</p>
                </div>
                <Switch
                  checked={midtransForm.is_enabled}
                  onCheckedChange={(checked) => setMidtransForm({ ...midtransForm, is_enabled: checked })}
                />
              </div>

              {/* Merchant ID */}
              <div className="space-y-2">
                <Label>Merchant ID</Label>
                <Input
                  value={midtransForm.merchant_id}
                  onChange={(e) => setMidtransForm({ ...midtransForm, merchant_id: e.target.value })}
                  placeholder="Masukkan Merchant ID..."
                />
                {midtransConfig?.merchant_id && (
                  <p className="text-xs text-muted-foreground">Merchant ID saat ini: {midtransConfig.merchant_id}</p>
                )}
              </div>

              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <div className="flex gap-3">
                  {['sandbox', 'production'].map((env) => (
                    <Button
                      key={env}
                      variant={midtransForm.environment === env ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMidtransForm({ ...midtransForm, environment: env })}
                    >
                      {env === 'sandbox' ? 'Sandbox (Testing)' : 'Production'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Server Key */}
              <div className="space-y-2">
                <Label>Server Key</Label>
                <div className="relative">
                  <Input
                    type={showServerKey ? 'text' : 'password'}
                    value={midtransForm.server_key}
                    onChange={(e) => setMidtransForm({ ...midtransForm, server_key: e.target.value })}
                    placeholder={midtransConfig?.server_key_set ? 'Biarkan kosong jika tidak ingin mengubah' : 'Masukkan Server Key...'}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowServerKey(!showServerKey)}
                    type="button"
                  >
                    {showServerKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {midtransConfig?.server_key_set && (
                  <p className="text-xs text-muted-foreground">Server Key sudah diset: {midtransConfig.server_key}</p>
                )}
              </div>

              {/* Client Key */}
              <div className="space-y-2">
                <Label>Client Key</Label>
                <Input
                  value={midtransForm.client_key}
                  onChange={(e) => setMidtransForm({ ...midtransForm, client_key: e.target.value })}
                  placeholder="Masukkan Client Key..."
                />
              </div>

              <Button onClick={handleSaveMidtrans} disabled={midtransSaving} className="w-full sm:w-auto">
                {midtransSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Konfigurasi Midtrans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== FLIP CONFIG ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Integrasi Flip
          </CardTitle>
          <CardDescription>Konfigurasi payment gateway Flip untuk pembayaran otomatis</CardDescription>
        </CardHeader>
        <CardContent>
          {flipLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 max-w-lg">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Aktifkan Flip</Label>
                  <p className="text-xs text-muted-foreground">Aktifkan pembayaran otomatis via Flip</p>
                </div>
                <Switch
                  checked={flipForm.is_enabled}
                  onCheckedChange={(checked) => setFlipForm({ ...flipForm, is_enabled: checked })}
                />
              </div>

              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <div className="flex gap-3">
                  {['sandbox', 'production'].map((env) => (
                    <Button
                      key={env}
                      variant={flipForm.environment === env ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFlipForm({ ...flipForm, environment: env })}
                    >
                      {env === 'sandbox' ? 'Sandbox (Testing)' : 'Production'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <div className="relative">
                  <Input
                    type={showFlipSecret ? 'text' : 'password'}
                    value={flipForm.secret_key}
                    onChange={(e) => setFlipForm({ ...flipForm, secret_key: e.target.value })}
                    placeholder={flipConfig?.secret_key_set ? 'Biarkan kosong jika tidak ingin mengubah' : 'Masukkan Secret Key...'}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowFlipSecret(!showFlipSecret)}
                    type="button"
                  >
                    {showFlipSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {flipConfig?.secret_key_set && (
                  <p className="text-xs text-muted-foreground">Secret Key sudah diset: {flipConfig.secret_key}</p>
                )}
              </div>

              {/* Validation Token */}
              <div className="space-y-2">
                <Label>Validation Token</Label>
                <div className="relative">
                  <Input
                    type={showFlipToken ? 'text' : 'password'}
                    value={flipForm.validation_token}
                    onChange={(e) => setFlipForm({ ...flipForm, validation_token: e.target.value })}
                    placeholder={flipConfig?.validation_token_set ? 'Biarkan kosong jika tidak ingin mengubah' : 'Masukkan Validation Token...'}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowFlipToken(!showFlipToken)}
                    type="button"
                  >
                    {showFlipToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {flipConfig?.validation_token_set && (
                  <p className="text-xs text-muted-foreground">Validation Token sudah diset: {flipConfig.validation_token}</p>
                )}
                <p className="text-xs text-muted-foreground">Token ini didapat dari dashboard Flip, digunakan untuk verifikasi callback.</p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  <strong>Callback URL:</strong> Masukkan URL berikut di dashboard Flip sebagai webhook/callback URL:
                </p>
                <code className="mt-1 block text-xs font-mono text-blue-800 bg-blue-100 rounded px-2 py-1">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/flip` : '/api/webhook/flip'}
                </code>
              </div>

              <Button onClick={handleSaveFlip} disabled={flipSaving} className="w-full sm:w-auto">
                {flipSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Konfigurasi Flip
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== BANK DIALOG ==================== */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBank ? 'Edit Rekening Bank' : 'Tambah Rekening Bank'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Bank</Label>
              <Input
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                placeholder="BCA, BNI, Mandiri, dll."
              />
            </div>
            <div className="space-y-2">
              <Label>Nomor Rekening</Label>
              <Input
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Pemilik Rekening</Label>
              <Input
                value={bankForm.account_holder}
                onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })}
                placeholder="PT. Contoh Perusahaan"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={bankForm.is_active}
                onCheckedChange={(checked) => setBankForm({ ...bankForm, is_active: checked })}
              />
              <Label className="text-sm">Aktif</Label>
            </div>
            <div className="space-y-2">
              <Label>Urutan Tampil</Label>
              <Input
                type="number"
                value={bankForm.sort_order}
                onChange={(e) => setBankForm({ ...bankForm, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowBankDialog(false)}>Batal</Button>
              <Button onClick={handleSaveBank} disabled={bankSaving}>
                {bankSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingBank ? 'Perbarui' : 'Tambah'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
