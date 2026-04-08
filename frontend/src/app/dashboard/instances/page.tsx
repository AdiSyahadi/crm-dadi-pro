'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Wifi, WifiOff, QrCode, Loader2, Trash2, RefreshCw, Smartphone, AlertTriangle, Settings, Cloud, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function InstancesPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone_number: '', wa_instance_id: '' });
  const [remoteInstances, setRemoteInstances] = useState<any[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const [qrDialog, setQrDialog] = useState<{ open: boolean; instanceId: string; qr: string; errorMsg: string }>({
    open: false,
    instanceId: '',
    qr: '',
    errorMsg: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['instances'],
    queryFn: async () => {
      const { data } = await api.get('/instances');
      return data.data;
    },
  });

  const { data: waApiSettings } = useQuery({
    queryKey: ['wa-api-settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings/wa-api');
      return data.data;
    },
  });

  const waApiDashboardUrl = waApiSettings?.wa_api_base_url
    ? (() => { try { const u = new URL(waApiSettings.wa_api_base_url); return u.origin; } catch { return ''; } })()
    : '';

  const instances = data || [];

  // Fetch remote instances when create dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setLoadingRemote(true);
      setRemoteError('');
      setRemoteInstances([]);
      api.get('/instances/remote')
        .then((res) => {
          const list = res.data?.data || [];
          setRemoteInstances(Array.isArray(list) ? list : []);
        })
        .catch((err) => {
          const msg = err.response?.data?.error?.message || '';
          if (msg.includes('not configured')) {
            setRemoteError('WA API belum dikonfigurasi. Konfigurasi di Settings terlebih dahulu.');
          } else {
            setRemoteError('Gagal mengambil daftar instance dari WA API.');
          }
        })
        .finally(() => setLoadingRemote(false));
    }
  }, [dialogOpen]);

  const createMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      await api.post('/instances', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      setDialogOpen(false);
      setForm({ name: '', phone_number: '', wa_instance_id: '' });
      toast.success('Instansi berhasil ditambahkan');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/instances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      toast.success('Instansi dihapus');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/instances/${id}/sync`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      const d = data.data;
      toast.success(data.message || `Sync selesai: ${d.conversations} percakapan, ${d.messages} pesan`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal sync pesan');
    },
  });

  const getQrMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.get(`/instances/${id}/qr`);
      return data.data;
    },
    onSuccess: (data, id) => {
      if (data?.status === 'connected') {
        // Instance already connected — refresh list and show success
        queryClient.invalidateQueries({ queryKey: ['instances'] });
        toast.success(data.message || 'Instance sudah terhubung!');
        return;
      }
      // Show dialog with message (QR or dashboard redirect)
      setQrDialog({
        open: true,
        instanceId: id,
        qr: data?.qr || '',
        errorMsg: data?.message || '',
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || '';
      if (msg.includes('not configured')) {
        setQrDialog({ open: true, instanceId: '', qr: '', errorMsg: 'not_configured' });
      } else if (msg.includes('tidak ditemukan')) {
        setQrDialog({ open: true, instanceId: '', qr: '', errorMsg: msg });
      } else {
        toast.error(msg || 'Gagal mendapatkan QR');
      }
    },
  });

  const selectRemoteInstance = (remote: any) => {
    setForm({
      name: remote.name || remote.instance_name || `Instance ${remote.id}`,
      phone_number: remote.phone_number || '',
      wa_instance_id: remote.id || remote.instance_id || '',
    });
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    CONNECTED: { label: 'Terhubung', color: 'bg-emerald-100 text-emerald-700', icon: Wifi },
    DISCONNECTED: { label: 'Terputus', color: 'bg-red-100 text-red-700', icon: WifiOff },
    CONNECTING: { label: 'Menghubungkan', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
    INITIALIZING: { label: 'Inisialisasi', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Instansi WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Kelola koneksi WhatsApp untuk organisasi Anda</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Instansi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tambah Instansi WhatsApp</DialogTitle>
            </DialogHeader>

            {/* Remote instances from WA API */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Cloud className="h-3.5 w-3.5" />
                Instance dari WA API
              </Label>

              {loadingRemote ? (
                <div className="flex items-center justify-center py-4 border rounded-lg bg-muted/30">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Mengambil daftar instance...</span>
                </div>
              ) : remoteError ? (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <div className="text-xs">
                    <p>{remoteError}</p>
                    <Link href="/dashboard/settings" className="underline font-medium">
                      Buka Settings
                    </Link>
                  </div>
                </div>
              ) : remoteInstances.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {remoteInstances.map((ri: any) => {
                    const riId = ri.id || ri.instance_id || '';
                    const isSelected = form.wa_instance_id === riId;
                    return (
                      <button
                        key={riId}
                        type="button"
                        onClick={() => selectRemoteInstance(ri)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2.5 border rounded-lg text-left transition-colors',
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        )}
                      >
                        <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ri.name || ri.instance_name || riId}</p>
                          <p className="text-xs text-muted-foreground">
                            {ri.phone_number || 'No phone'} · {ri.status || 'unknown'}
                          </p>
                        </div>
                        {isSelected && (
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                            Dipilih
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-3 border rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Tidak ada instance ditemukan di WA API</p>
                </div>
              )}
            </div>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">atau isi manual</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nama Instansi</Label>
                <Input
                  placeholder="CS Utama"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nomor WhatsApp</Label>
                <Input
                  placeholder="6281234567890"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>WA Instance ID</Label>
                <Input
                  placeholder="ID dari WA API (otomatis jika pilih dari daftar)"
                  value={form.wa_instance_id}
                  onChange={(e) => setForm({ ...form, wa_instance_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  ID instance di WA API. Pilih dari daftar di atas atau isi manual.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Tambah
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* QR / Status Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(open) => setQrDialog({ ...qrDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Status Instance</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDialog.qr ? (
              <>
                <div className="border rounded-lg p-4 bg-white">
                  <img src={qrDialog.qr} alt="QR Code" className="w-64 h-64" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Buka WhatsApp di HP &gt; Linked Devices &gt; Link a Device &gt; Scan QR
                </p>
              </>
            ) : qrDialog.errorMsg === 'not_configured' ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <Settings className="h-16 w-16 text-muted-foreground/30" />
                <p className="text-sm font-medium">WhatsApp API Belum Dikonfigurasi</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Konfigurasi WA API URL dan API Key terlebih dahulu di halaman Settings.
                </p>
                <Link href="/dashboard/settings">
                  <Button variant="outline" size="sm" className="mt-2">
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    Buka Settings
                  </Button>
                </Link>
              </div>
            ) : qrDialog.errorMsg && qrDialog.errorMsg.includes('tidak ditemukan') ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <AlertTriangle className="h-16 w-16 text-amber-400" />
                <p className="text-sm font-medium text-center">Instance Tidak Ditemukan</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {qrDialog.errorMsg}
                </p>
              </div>
            ) : qrDialog.errorMsg && qrDialog.errorMsg.includes('Dashboard') ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <QrCode className="h-16 w-16 text-blue-400" />
                <p className="text-sm font-medium text-center">QR Code via Dashboard</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {qrDialog.errorMsg}
                </p>
                <a href={waApiDashboardUrl || '#'} target="_blank" rel="noopener noreferrer" className={cn(!waApiDashboardUrl && 'pointer-events-none opacity-50')}>
                  <Button variant="default" size="sm" className="mt-2">
                    Buka WA API Dashboard
                  </Button>
                </a>
              </div>
            ) : qrDialog.errorMsg ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <AlertTriangle className="h-16 w-16 text-amber-400" />
                <p className="text-sm font-medium text-center">Info</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {qrDialog.errorMsg}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6">
                <QrCode className="h-16 w-16 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">QR Code tidak tersedia</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Smartphone className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Belum ada instansi WhatsApp</p>
            <p className="text-sm text-muted-foreground mt-1">Tambahkan instansi untuk mulai menerima pesan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst: any) => {
            const sc = statusConfig[inst.status] || statusConfig.DISCONNECTED;
            const StatusIcon = sc.icon;
            return (
              <Card key={inst.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{inst.name}</h3>
                        <p className="text-xs text-muted-foreground">{inst.phone_number}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={cn('text-[10px]', sc.color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {sc.label}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground mt-2 truncate" title={inst.wa_instance_id}>
                    ID: {inst.wa_instance_id}
                  </div>

                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => getQrMutation.mutate(inst.id)}
                        disabled={getQrMutation.isPending}
                      >
                        {getQrMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : inst.status === 'CONNECTED' ? (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        ) : (
                          <QrCode className="h-3.5 w-3.5 mr-1" />
                        )}
                        {inst.status === 'CONNECTED' ? 'Sync Status' : 'Cek Status / QR'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => openConfirm({ title: 'Hapus instansi ini?', description: 'Instansi WhatsApp akan dihapus permanen.', onConfirm: () => deleteMutation.mutate(inst.id) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {inst.status === 'CONNECTED' && (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => syncMutation.mutate(inst.id)}
                        disabled={syncMutation.isPending}
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5 mr-1" />
                        )}
                        {syncMutation.isPending ? 'Sedang sync...' : 'Sync Pesan dari WA API'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
