'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Timer, Loader2, Settings, BarChart3, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SlaPage() {
  const queryClient = useQueryClient();

  // ── Settings ──
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['sla-settings'],
    queryFn: async () => (await api.get('/sla/settings')).data.data,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/sla/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-settings'] });
      toast.success('SLA settings disimpan');
    },
    onError: () => toast.error('Gagal menyimpan settings'),
  });

  // ── Stats ──
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['sla-stats'],
    queryFn: async () => (await api.get('/sla/stats')).data.data,
  });

  if (loadingSettings || loadingStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Timer className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">SLA Management</h1>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Statistik</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /> Pengaturan</TabsTrigger>
        </TabsList>

        {/* ── Stats Tab ── */}
        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Percakapan SLA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Sesuai SLA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{stats?.within_sla ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Terlewat SLA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{stats?.breached ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-blue-500" /> Compliance Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{stats?.compliance_rate ?? 100}%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SLA Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Aktifkan SLA</Label>
                  <p className="text-xs text-muted-foreground">Otomatis pantau waktu respon dan resolusi</p>
                </div>
                <Switch
                  checked={settings?.is_enabled ?? false}
                  onCheckedChange={(checked) => updateMutation.mutate({ is_enabled: checked })}
                />
              </div>

              {/* First Response */}
              <div className="space-y-2">
                <Label>Batas Respon Pertama (menit)</Label>
                <Input
                  type="number"
                  min={1}
                  defaultValue={settings?.first_response_minutes ?? 30}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val !== settings?.first_response_minutes) {
                      updateMutation.mutate({ first_response_minutes: val });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Waktu maksimal agent harus membalas pesan pertama</p>
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <Label>Batas Resolusi (menit)</Label>
                <Input
                  type="number"
                  min={1}
                  defaultValue={settings?.resolution_minutes ?? 1440}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val !== settings?.resolution_minutes) {
                      updateMutation.mutate({ resolution_minutes: val });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Waktu maksimal percakapan harus diselesaikan (1440 = 24 jam)</p>
              </div>

              {/* Warning Threshold */}
              <div className="space-y-2">
                <Label>Peringatan SLA (%)</Label>
                <Input
                  type="number"
                  min={50}
                  max={99}
                  defaultValue={settings?.warning_threshold_pct ?? 80}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val >= 50 && val <= 99 && val !== settings?.warning_threshold_pct) {
                      updateMutation.mutate({ warning_threshold_pct: val });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Kirim peringatan saat waktu SLA sudah terpakai sebanyak X%</p>
              </div>

              {/* Escalation */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-Eskalasi</Label>
                  <p className="text-xs text-muted-foreground">Notifikasi otomatis ke Supervisor & Admin saat SLA terlewati</p>
                </div>
                <Switch
                  checked={settings?.escalation_enabled ?? true}
                  onCheckedChange={(checked) => updateMutation.mutate({ escalation_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
