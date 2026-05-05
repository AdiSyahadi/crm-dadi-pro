'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useConfirmStore } from '@/stores/confirm.store';
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
  Receipt,
  CreditCard,
  Wallet,
  Save,
  Smartphone,
} from 'lucide-react';
import { WebhookSettings } from '@/components/settings/webhook-settings';
import { toast } from 'sonner';
import { FlipConfigTab } from '@/components/settings/flip-config-tab';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const queryClient = useQueryClient();
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  // Sync profile form when user data loads/changes
  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', phone: user.phone || '' });
    }
  }, [user]);

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (input: { name: string; phone: string }) => {
      await api.patch('/auth/profile', input);
    },
    onSuccess: async () => {
      await fetchProfile();
      toast.success('Profil berhasil disimpan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan profil');
    },
  });

  // Org form state
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (user?.organization?.name) {
      setOrgName(user.organization.name);
    }
  }, [user?.organization?.name]);

  const saveOrgMutation = useMutation({
    mutationFn: async (input: { name: string }) => {
      await api.patch('/settings/organization', input);
    },
    onSuccess: async () => {
      await fetchProfile();
      toast.success('Organisasi berhasil diperbarui');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan organisasi');
    },
  });

  // Auto-response state
  const [arNewChatTemplateId, setArNewChatTemplateId] = useState('');
  const [arNewChatCooldown, setArNewChatCooldown] = useState(60);
  const [arOutsideTemplateId, setArOutsideTemplateId] = useState('');
  const [arOutsideCooldown, setArOutsideCooldown] = useState(60);
  const [arOutsideStart, setArOutsideStart] = useState('08:00');
  const [arOutsideEnd, setArOutsideEnd] = useState('17:00');
  const [arOutsideDays, setArOutsideDays] = useState<number[]>([1,2,3,4,5]);
  const [arNewChatInstanceId, setArNewChatInstanceId] = useState('');
  const [arOutsideInstanceId, setArOutsideInstanceId] = useState('');

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
  const { data: arInstances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: async () => {
      const { data } = await api.get('/instances');
      return (data.data || []) as { id: string; name: string; phone_number: string | null }[];
    },
    staleTime: 60_000,
  });

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
      setArNewChatInstanceId(newChat.wa_instance_id || '');
    }
    const outside = arRules.find((r: any) => r.trigger === 'OUTSIDE_HOURS');
    if (outside) {
      setArOutsideTemplateId(outside.template_id);
      setArOutsideCooldown(outside.cooldown_minutes);
      setArOutsideInstanceId(outside.wa_instance_id || '');
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

      <Tabs defaultValue="profile">
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
          <TabsTrigger value="receipt">
            <Receipt className="h-4 w-4 mr-1.5" />
            Kwitansi
          </TabsTrigger>
          <TabsTrigger value="midtrans">
            <CreditCard className="h-4 w-4 mr-1.5" />
            Midtrans
          </TabsTrigger>
          <TabsTrigger value="flip">
            <Wallet className="h-4 w-4 mr-1.5" />
            Flip
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

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!profileForm.name.trim()) {
                    toast.error('Nama tidak boleh kosong');
                    return;
                  }
                  saveProfileMutation.mutate(profileForm);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nama</Label>
                    <Input
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Nama lengkap"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input defaultValue={user?.email || ''} type="email" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={saveProfileMutation.isPending}>
                    {saveProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Simpan Profil
                  </Button>
                </div>
              </form>

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
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    ⚠️ Anda akan otomatis logout setelah mengubah password
                  </p>
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!orgName.trim() || orgName.trim().length < 2) {
                    toast.error('Nama organisasi minimal 2 karakter');
                    return;
                  }
                  saveOrgMutation.mutate({ name: orgName.trim() });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nama Organisasi</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Nama organisasi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input defaultValue={user?.organization?.slug || ''} disabled />
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Paket Saat Ini</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Anda menggunakan paket{' '}
                    <span className="font-semibold text-foreground">
                      {user?.organization?.plan || 'FREE'}
                    </span>.
                    Upgrade untuk fitur lebih lengkap.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/dashboard/billing'}>
                    Upgrade Paket
                  </Button>
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" disabled={saveOrgMutation.isPending}>
                    {saveOrgMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          {user?.organization?.planLimits?.features?.webhookConfigs ? (
            <WebhookSettings />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Lock className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Fitur Webhook (n8n / Integrasi)</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  Fitur Webhook hanya tersedia untuk paket <strong>Professional</strong> ke atas.
                  Upgrade paket Anda untuk menghubungkan CRM dengan n8n, Zapier, atau sistem eksternal lainnya.
                </p>
                <a href="/dashboard/pricing">
                  <Button>
                    <Zap className="h-4 w-4 mr-2" />
                    Lihat Paket &amp; Upgrade
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => openConfirm({ title: 'Hapus auto-response ini?', description: 'Auto-response untuk chat baru akan dinonaktifkan.', onConfirm: () => arDeleteMutation.mutate('NEW_CHAT') })}>
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
                    {arInstances.length > 1 && (
                      <div className="space-y-2">
                        <Label>Instance WhatsApp <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                        <Select value={arNewChatInstanceId || '__all__'} onValueChange={(v) => setArNewChatInstanceId(v === '__all__' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Pilih instance..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Semua Instance</SelectItem>
                            {arInstances.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id}>{inst.name}{inst.phone_number ? ` (${inst.phone_number})` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Jika dipilih, greeting hanya berlaku untuk instance tersebut.</p>
                      </div>
                    )}
                    <Button disabled={!arNewChatTemplateId || arUpsertMutation.isPending} onClick={() => arUpsertMutation.mutate({ trigger: 'NEW_CHAT', template_id: arNewChatTemplateId, cooldown_minutes: arNewChatCooldown, wa_instance_id: arNewChatInstanceId || undefined })}>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => openConfirm({ title: 'Hapus auto-response ini?', description: 'Auto-response di luar jam kerja akan dinonaktifkan.', onConfirm: () => arDeleteMutation.mutate('OUTSIDE_HOURS') })}>
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
                    {arInstances.length > 1 && (
                      <div className="space-y-2">
                        <Label>Instance WhatsApp <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                        <Select value={arOutsideInstanceId || '__all__'} onValueChange={(v) => setArOutsideInstanceId(v === '__all__' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Pilih instance..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Semua Instance</SelectItem>
                            {arInstances.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id}>{inst.name}{inst.phone_number ? ` (${inst.phone_number})` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Jika dipilih, auto-response hanya berlaku untuk instance tersebut.</p>
                      </div>
                    )}
                    <Button disabled={!arOutsideTemplateId || arUpsertMutation.isPending} onClick={() => arUpsertMutation.mutate({ trigger: 'OUTSIDE_HOURS', template_id: arOutsideTemplateId, business_hour_start: arOutsideStart, business_hour_end: arOutsideEnd, business_days: arOutsideDays, cooldown_minutes: arOutsideCooldown, wa_instance_id: arOutsideInstanceId || undefined })}>
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
          <NotificationPreferencesTab />
        </TabsContent>

        {/* Receipt Config Tab */}
        <TabsContent value="receipt" className="space-y-4">
          <ReceiptConfigTab />
        </TabsContent>

        {/* Midtrans Tab */}
        <TabsContent value="midtrans" className="space-y-4">
          <MidtransConfigTab />
        </TabsContent>

        {/* Flip Tab */}
        <TabsContent value="flip" className="space-y-4">
          <FlipConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Notification Preferences Tab (extracted to avoid hooks-in-map) ─── */

const NOTIF_ITEMS = [
  { key: 'new_message' as const, label: 'Pesan masuk baru', desc: 'Notifikasi saat ada pesan WhatsApp masuk' },
  { key: 'assigned' as const, label: 'Percakapan ditugaskan', desc: 'Notifikasi saat percakapan ditugaskan ke Anda' },
  { key: 'deal_update' as const, label: 'Deal update', desc: 'Notifikasi saat ada perubahan pada deal' },
  { key: 'broadcast_completed' as const, label: 'Broadcast selesai', desc: 'Notifikasi saat broadcast selesai dikirim' },
];

type NotifPrefs = Record<string, boolean>;

function NotificationPreferencesTab() {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotifPrefs>({
    new_message: true,
    assigned: true,
    deal_update: true,
    broadcast_completed: true,
  });

  const { data: fetchedPrefs, isLoading } = useQuery<NotifPrefs>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const { data } = await api.get('/settings/notification-preferences');
      return data.data;
    },
  });

  useEffect(() => {
    if (fetchedPrefs) setPrefs(fetchedPrefs);
  }, [fetchedPrefs]);

  const saveMutation = useMutation({
    mutationFn: async (input: NotifPrefs) => {
      await api.put('/settings/notification-preferences', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Pengaturan notifikasi berhasil disimpan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pengaturan Notifikasi</CardTitle>
        <CardDescription>Atur notifikasi yang ingin Anda terima</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {NOTIF_ITEMS.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={prefs[item.key] ?? true}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate(prefs)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Simpan Perubahan
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Receipt Config Tab ─── */
function ReceiptConfigTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    org_name: '',
    org_address: '',
    org_phone: '',
    org_email: '',
    primary_color: '#687EFF',
    footer_text: '',
    signature_name: '',
    signature_title: '',
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['receipt-config'],
    queryFn: async () => {
      const { data } = await api.get('/receipts/config');
      return data.data;
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        org_name: config.org_name || '',
        org_address: config.org_address || '',
        org_phone: config.org_phone || '',
        org_email: config.org_email || '',
        primary_color: config.primary_color || '#687EFF',
        footer_text: config.footer_text || '',
        signature_name: config.signature_name || '',
        signature_title: config.signature_title || '',
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      await api.put('/receipts/config', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt-config'] });
      toast.success('Konfigurasi kwitansi berhasil disimpan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan konfigurasi');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Konfigurasi Kwitansi Otomatis
        </CardTitle>
        <CardDescription>
          Atur branding dan informasi organisasi yang akan tampil pada PDF kwitansi yang digenerate otomatis maupun manual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nama Organisasi</Label>
            <Input
              placeholder="PT Contoh Indonesia"
              value={form.org_name}
              onChange={(e) => setForm({ ...form, org_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email Organisasi</Label>
            <Input
              type="email"
              placeholder="info@contoh.com"
              value={form.org_email}
              onChange={(e) => setForm({ ...form, org_email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>No. Telepon</Label>
            <Input
              placeholder="021-12345678"
              value={form.org_phone}
              onChange={(e) => setForm({ ...form, org_phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Warna Utama</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="flex-1"
                maxLength={10}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Alamat Organisasi</Label>
          <Input
            placeholder="Jl. Contoh No.1, Jakarta 12345"
            value={form.org_address}
            onChange={(e) => setForm({ ...form, org_address: e.target.value })}
          />
        </div>

        <Separator />

        <h4 className="text-sm font-medium">Tanda Tangan</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nama Penanda Tangan</Label>
            <Input
              placeholder="Ahmad Fauzi"
              value={form.signature_name}
              onChange={(e) => setForm({ ...form, signature_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Jabatan</Label>
            <Input
              placeholder="Direktur Keuangan"
              value={form.signature_title}
              onChange={(e) => setForm({ ...form, signature_title: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Footer Text</Label>
          <Input
            placeholder="Terima kasih atas kepercayaan Anda"
            value={form.footer_text}
            onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Simpan Konfigurasi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Midtrans Config Tab ─── */
interface MidtransConfigData {
  merchant_id: string;
  server_key: string;
  server_key_set: boolean;
  client_key: string;
  environment: string;
  is_enabled: boolean;
}

function MidtransConfigTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    merchant_id: '',
    server_key: '',
    client_key: '',
    environment: 'sandbox',
    is_enabled: false,
  });
  const [showServerKey, setShowServerKey] = useState(false);

  const { data: config, isLoading } = useQuery<MidtransConfigData>({
    queryKey: ['midtrans-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/midtrans');
      return data.data;
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        merchant_id: config.merchant_id || '',
        server_key: '',
        client_key: config.client_key || '',
        environment: config.environment || 'sandbox',
        is_enabled: config.is_enabled || false,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      const payload: Record<string, string | boolean> = {
        merchant_id: input.merchant_id,
        client_key: input.client_key,
        environment: input.environment,
        is_enabled: input.is_enabled ? 'true' : 'false',
      };
      if (input.server_key.trim()) {
        payload.server_key = input.server_key;
      }
      await api.put('/settings/midtrans', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['midtrans-config'] });
      toast.success('Konfigurasi Midtrans berhasil disimpan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan konfigurasi Midtrans');
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/settings/midtrans/test');
      return data.data;
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast.success(`${data.message} (${data.environment})`);
      } else {
        toast.error(data.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menguji koneksi');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Integrasi Midtrans
        </CardTitle>
        <CardDescription>
          Konfigurasi payment gateway Midtrans untuk pembayaran otomatis pada deal.
          Dapatkan kredensial dari{' '}
          <a href="https://dashboard.midtrans.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            dashboard.midtrans.com
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status indicator */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            {config?.is_enabled && config?.server_key_set ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700">Midtrans Aktif</p>
                  <p className="text-xs text-muted-foreground">
                    Environment: <span className="font-medium">{config.environment}</span>
                    {config.merchant_id && <> • Merchant ID: <span className="font-mono">{config.merchant_id}</span></>}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                  <XCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700">Midtrans Belum Aktif</p>
                  <p className="text-xs text-muted-foreground">
                    {!config?.server_key_set ? 'Server Key belum diisi.' : 'Midtrans dinonaktifkan.'} Isi form di bawah untuk mengaktifkan.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Aktifkan Midtrans</Label>
            <p className="text-xs text-muted-foreground">Aktifkan pembayaran otomatis via Midtrans</p>
          </div>
          <Switch
            checked={form.is_enabled}
            onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
          />
        </div>

        {/* Merchant ID */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            Merchant ID
          </Label>
          <Input
            value={form.merchant_id}
            onChange={(e) => setForm({ ...form, merchant_id: e.target.value })}
            placeholder="G573194614"
          />
          <p className="text-xs text-muted-foreground">
            Merchant ID dari dashboard Midtrans Anda.
          </p>
        </div>

        {/* Server Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Server Key
          </Label>
          <div className="relative">
            <Input
              type={showServerKey ? 'text' : 'password'}
              value={form.server_key}
              onChange={(e) => setForm({ ...form, server_key: e.target.value })}
              placeholder={config?.server_key_set ? 'Biarkan kosong jika tidak ingin mengubah' : 'SB-Mid-server-xxxx'}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowServerKey(!showServerKey)}
            >
              {showServerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {config?.server_key_set && (
            <p className="text-xs text-muted-foreground">Server Key sudah diset: {config.server_key}</p>
          )}
        </div>

        {/* Client Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Client Key
          </Label>
          <Input
            value={form.client_key}
            onChange={(e) => setForm({ ...form, client_key: e.target.value })}
            placeholder="SB-Mid-client-xxxx"
          />
        </div>

        {/* Environment */}
        <div className="space-y-2">
          <Label>Environment</Label>
          <div className="flex gap-3">
            {(['sandbox', 'production'] as const).map((env) => (
              <Button
                key={env}
                variant={form.environment === env ? 'default' : 'outline'}
                size="sm"
                type="button"
                onClick={() => setForm({ ...form, environment: env })}
              >
                {env === 'sandbox' ? 'Sandbox (Testing)' : 'Production'}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Gunakan <span className="font-medium">Sandbox</span> untuk testing, <span className="font-medium">Production</span> untuk transaksi nyata.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Konfigurasi
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testMutation.isPending || !config?.server_key_set}
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
      </CardContent>
    </Card>
  );
}
