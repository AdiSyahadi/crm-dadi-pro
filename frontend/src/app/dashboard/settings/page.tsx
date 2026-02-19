'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Building2,
  Bell,
  Shield,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Wifi,
  Key,
  Globe,
  Lock,
  Zap,
  Bot,
  Clock,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { WebhookSettings } from '@/components/settings/webhook-settings';
import { toast } from 'sonner';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // Auto-response state
  const [arNewChatTemplateId, setArNewChatTemplateId] = useState('');
  const [arNewChatCooldown, setArNewChatCooldown] = useState(60);
  const [arOutsideTemplateId, setArOutsideTemplateId] = useState('');
  const [arOutsideCooldown, setArOutsideCooldown] = useState(60);
  const [arOutsideStart, setArOutsideStart] = useState('08:00');
  const [arOutsideEnd, setArOutsideEnd] = useState('17:00');
  const [arOutsideDays, setArOutsideDays] = useState<number[]>([1,2,3,4,5]);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  // WA API config state
  const [waForm, setWaForm] = useState({
    wa_api_base_url: '',
    wa_api_key: '',
    wa_organization_id: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);

  // Fetch current WA API config
  const { data: waConfig, isLoading: loadingWaConfig } = useQuery({
    queryKey: ['wa-api-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/wa-api');
      return data.data;
    },
  });

  // Populate form when config is loaded
  useEffect(() => {
    if (waConfig) {
      setWaForm({
        wa_api_base_url: waConfig.wa_api_base_url || '',
        wa_api_key: waConfig.wa_api_key_set ? waConfig.wa_api_key : '',
        wa_organization_id: waConfig.wa_organization_id || '',
      });
    }
  }, [waConfig]);

  // Save WA API config
  const saveWaMutation = useMutation({
    mutationFn: async (input: typeof waForm) => {
      const payload: any = {
        wa_api_base_url: input.wa_api_base_url,
        wa_api_key: input.wa_api_key,
        wa_organization_id: input.wa_organization_id || undefined,
      };
      // If API key wasn't changed, send the original (masked) key won't work
      // so only send if user actually typed a new key
      if (!apiKeyChanged && waConfig?.wa_api_key_set) {
        // Don't update the key if it wasn't changed
        delete payload.wa_api_key;
      }
      await api.put('/settings/wa-api', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-api-config'] });
      setApiKeyChanged(false);
      toast.success('Konfigurasi WA API berhasil disimpan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan konfigurasi');
    },
  });

  // Test WA API connection
  const testMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/settings/wa-api/test');
      return data.data;
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast.success(`${data.message} (${data.instances_count} instansi ditemukan)`);
      } else {
        toast.error(data.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menguji koneksi');
    },
  });

  const changePwMutation = useMutation({
    mutationFn: async (input: { oldPassword: string; newPassword: string }) => {
      await api.post('/auth/change-password', input);
    },
    onSuccess: () => {
      toast.success('Password berhasil diubah. Silakan login ulang.');
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => logout(), 1500);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengubah password');
    },
  });

  // Auto-response queries
  const { data: arRules = [], isLoading: arLoading } = useQuery({
    queryKey: ['auto-responses'],
    queryFn: async () => {
      const { data } = await api.get('/auto-responses');
      return data.data || [];
    },
  });

  const { data: arTemplates = [] } = useQuery({
    queryKey: ['templates-active'],
    queryFn: async () => {
      const { data } = await api.get('/templates?is_active=true&limit=50');
      return (data.data || []) as { id: string; name: string; category: string | null; content: string }[];
    },
    staleTime: 60_000,
  });

  // Populate auto-response form from existing rules
  useEffect(() => {
    const newChat = arRules.find((r: any) => r.trigger === 'NEW_CHAT');
    if (newChat) {
      setArNewChatTemplateId(newChat.template_id);
      setArNewChatCooldown(newChat.cooldown_minutes);
    }
    const outside = arRules.find((r: any) => r.trigger === 'OUTSIDE_HOURS');
    if (outside) {
      setArOutsideTemplateId(outside.template_id);
      setArOutsideCooldown(outside.cooldown_minutes);
      if (outside.business_hour_start) setArOutsideStart(outside.business_hour_start);
      if (outside.business_hour_end) setArOutsideEnd(outside.business_hour_end);
      if (Array.isArray(outside.business_days)) setArOutsideDays(outside.business_days);
    }
  }, [arRules]);

  const arUpsertMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.put('/auto-responses', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-responses'] });
      toast.success('Auto-response berhasil disimpan');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menyimpan'),
  });

  const arToggleMutation = useMutation({
    mutationFn: async ({ trigger, isActive }: { trigger: string; isActive: boolean }) => {
      const rule = arRules.find((r: any) => r.trigger === trigger);
      if (!rule) return;
      await api.put('/auto-responses', { trigger, template_id: rule.template_id, is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-responses'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal mengubah status'),
  });

  const arDeleteMutation = useMutation({
    mutationFn: async (trigger: string) => {
      await api.delete(`/auto-responses/${trigger}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-responses'] });
      toast.success('Auto-response dihapus');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghapus'),
  });

  const AR_DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola profil dan pengaturan organisasi</p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            WhatsApp API
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1.5" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="organization">
            <Building2 className="h-4 w-4 mr-1.5" />
            Organisasi
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Zap className="h-4 w-4 mr-1.5" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="auto-response">
            <Bot className="h-4 w-4 mr-1.5" />
            Auto-Response
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1.5" />
            Notifikasi
          </TabsTrigger>
        </TabsList>

        {/* WhatsApp API Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Konfigurasi WhatsApp API
              </CardTitle>
              <CardDescription>
                Hubungkan CRM dengan WhatsApp API untuk mengirim dan menerima pesan.
                Dapatkan API URL dan API Key dari penyedia WhatsApp API Anda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingWaConfig ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveWaMutation.mutate(waForm);
                  }}
                  className="space-y-5"
                >
                  {/* Status indicator */}
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                      {waConfig?.wa_api_key_set ? (
                        <>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-emerald-700">WA API Terkonfigurasi</p>
                            <p className="text-xs text-muted-foreground">API Key sudah tersimpan. Anda bisa menghubungkan instansi WhatsApp.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                            <XCircle className="h-5 w-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-amber-700">WA API Belum Dikonfigurasi</p>
                            <p className="text-xs text-muted-foreground">Isi form di bawah untuk menghubungkan WhatsApp API.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      Base URL API
                    </Label>
                    <Input
                      placeholder="http://localhost:3001/api/v1"
                      value={waForm.wa_api_base_url}
                      onChange={(e) => setWaForm({ ...waForm, wa_api_base_url: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      URL dasar dari WhatsApp API. Contoh: <code className="bg-muted px-1 rounded">http://localhost:3001/api/v1</code>
                    </p>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      API Key
                    </Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={waConfig?.wa_api_key_set ? 'API Key sudah tersimpan (ketik untuk ganti)' : 'wa_xxxxxxxxxxxxxxxx'}
                        value={apiKeyChanged ? waForm.wa_api_key : (waConfig?.wa_api_key_set ? waForm.wa_api_key : '')}
                        onChange={(e) => {
                          setWaForm({ ...waForm, wa_api_key: e.target.value });
                          setApiKeyChanged(true);
                        }}
                        required={!waConfig?.wa_api_key_set}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      API Key untuk autentikasi. Dikirim sebagai header <code className="bg-muted px-1 rounded">X-API-Key</code>.
                    </p>
                  </div>

                  {/* Organization ID (optional) */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Organization ID <span className="text-muted-foreground text-xs">(opsional)</span>
                    </Label>
                    <Input
                      placeholder="org-uuid (opsional)"
                      value={waForm.wa_organization_id}
                      onChange={(e) => setWaForm({ ...waForm, wa_organization_id: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID organisasi di WA API, jika diperlukan oleh provider.
                    </p>
                  </div>

                  {/* API Permissions Info */}
                  <div className="rounded-lg border p-4 bg-muted/20">
                    <p className="text-xs font-semibold mb-2">Permission API Key yang Dibutuhkan:</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        'message:read',
                        'message:send',
                        'contact:read',
                        'contact:write',
                        'instance:read',
                        'webhook:read',
                        'webhook:write',
                      ].map((perm) => (
                        <div key={perm} className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <code className="text-[11px] text-muted-foreground">{perm}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saveWaMutation.isPending}>
                      {saveWaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Simpan Konfigurasi
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={testMutation.isPending || !waConfig?.wa_api_key_set}
                      onClick={() => testMutation.mutate()}
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Wifi className="h-4 w-4 mr-2" />
                      )}
                      Test Koneksi
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informasi Profil</CardTitle>
              <CardDescription>Perbarui informasi profil Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">{user?.role}</Badge>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nama</Label>
                  <Input defaultValue={user?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={user?.email || ''} type="email" />
                </div>
              </div>

              <Separator />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pwForm.newPassword !== pwForm.confirmPassword) {
                    toast.error('Konfirmasi password tidak cocok');
                    return;
                  }
                  if (pwForm.newPassword.length < 8) {
                    toast.error('Password baru minimal 8 karakter');
                    return;
                  }
                  changePwMutation.mutate({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
                }}
              >
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Ubah Password
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Password Lama</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={pwForm.oldPassword}
                      onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password Baru</Label>
                    <Input
                      type="password"
                      placeholder="Minimal 8 karakter"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Konfirmasi Password</Label>
                    <Input
                      type="password"
                      placeholder="Ulangi password baru"
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={changePwMutation.isPending}>
                    {changePwMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Ubah Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informasi Organisasi</CardTitle>
              <CardDescription>Pengaturan organisasi Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nama Organisasi</Label>
                  <Input defaultValue={user?.organization?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input defaultValue={user?.organization?.slug || ''} disabled />
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Paket Saat Ini</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Anda menggunakan paket <span className="font-semibold text-foreground">Free Trial</span>.
                  Upgrade untuk fitur lebih lengkap.
                </p>
                <Button variant="outline" size="sm" className="mt-3">
                  Upgrade Paket
                </Button>
              </div>

              <div className="flex justify-end">
                <Button>Simpan Perubahan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <WebhookSettings />
        </TabsContent>

        {/* Auto-Response Tab */}
        <TabsContent value="auto-response" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Greeting — Kontak Baru
              </CardTitle>
              <CardDescription>
                Kirim pesan otomatis saat kontak baru pertama kali mengirim pesan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const rule = arRules.find((r: any) => r.trigger === 'NEW_CHAT');
                return (
                  <>
                    {rule && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium">Aktif</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={rule.is_active} onCheckedChange={(v) => arToggleMutation.mutate({ trigger: 'NEW_CHAT', isActive: v })} />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Hapus auto-response ini?')) arDeleteMutation.mutate('NEW_CHAT'); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Template Pesan</Label>
                      <Select value={arNewChatTemplateId} onValueChange={setArNewChatTemplateId}>
                        <SelectTrigger><SelectValue placeholder="Pilih template..." /></SelectTrigger>
                        <SelectContent>
                          {arTemplates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cooldown (menit)</Label>
                      <Input type="number" min={1} max={1440} value={arNewChatCooldown} onChange={(e) => setArNewChatCooldown(parseInt(e.target.value) || 60)} />
                      <p className="text-xs text-muted-foreground">Jeda minimum sebelum mengirim ulang ke kontak yang sama.</p>
                    </div>
                    <Button disabled={!arNewChatTemplateId || arUpsertMutation.isPending} onClick={() => arUpsertMutation.mutate({ trigger: 'NEW_CHAT', template_id: arNewChatTemplateId, cooldown_minutes: arNewChatCooldown })}>
                      {arUpsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {rule ? 'Perbarui' : 'Simpan'}
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Di Luar Jam Kerja
              </CardTitle>
              <CardDescription>
                Kirim pesan otomatis saat pesan masuk di luar jam kerja.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const rule = arRules.find((r: any) => r.trigger === 'OUTSIDE_HOURS');
                return (
                  <>
                    {rule && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium">Aktif</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={rule.is_active} onCheckedChange={(v) => arToggleMutation.mutate({ trigger: 'OUTSIDE_HOURS', isActive: v })} />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Hapus auto-response ini?')) arDeleteMutation.mutate('OUTSIDE_HOURS'); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Template Pesan</Label>
                      <Select value={arOutsideTemplateId} onValueChange={setArOutsideTemplateId}>
                        <SelectTrigger><SelectValue placeholder="Pilih template..." /></SelectTrigger>
                        <SelectContent>
                          {arTemplates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Jam Mulai Kerja</Label>
                        <Input type="time" value={arOutsideStart} onChange={(e) => setArOutsideStart(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Jam Selesai Kerja</Label>
                        <Input type="time" value={arOutsideEnd} onChange={(e) => setArOutsideEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Hari Kerja</Label>
                      <div className="flex gap-1">
                        {AR_DAY_LABELS.map((d, i) => (
                          <button key={i} type="button" className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${arOutsideDays.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`} onClick={() => setArOutsideDays((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort())}>{d}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Cooldown (menit)</Label>
                      <Input type="number" min={1} max={1440} value={arOutsideCooldown} onChange={(e) => setArOutsideCooldown(parseInt(e.target.value) || 60)} />
                    </div>
                    <Button disabled={!arOutsideTemplateId || arUpsertMutation.isPending} onClick={() => arUpsertMutation.mutate({ trigger: 'OUTSIDE_HOURS', template_id: arOutsideTemplateId, business_hour_start: arOutsideStart, business_hour_end: arOutsideEnd, business_days: arOutsideDays, cooldown_minutes: arOutsideCooldown })}>
                      {arUpsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {rule ? 'Perbarui' : 'Simpan'}
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pengaturan Notifikasi</CardTitle>
              <CardDescription>Atur notifikasi yang ingin Anda terima</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { label: 'Pesan masuk baru', desc: 'Notifikasi saat ada pesan WhatsApp masuk' },
                  { label: 'Percakapan ditugaskan', desc: 'Notifikasi saat percakapan ditugaskan ke Anda' },
                  { label: 'Deal update', desc: 'Notifikasi saat ada perubahan pada deal' },
                  { label: 'Broadcast selesai', desc: 'Notifikasi saat broadcast selesai dikirim' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-input accent-primary" />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button>Simpan Perubahan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
