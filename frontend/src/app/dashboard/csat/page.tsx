'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Loader2, Settings, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STARS = [1, 2, 3, 4, 5] as const;
const STAR_LABELS: Record<number, string> = {
  1: 'Sangat Buruk',
  2: 'Buruk',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Baik',
};
const STAR_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-lime-500',
  5: 'bg-green-500',
};

export default function CSATPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('analytics');
  const [timeRange, setTimeRange] = useState('30');

  const getDateRange = () => {
    if (timeRange === 'all') return {};
    const days = parseInt(timeRange, 10);
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return { start_date: start };
  };

  // ─── Settings ───────────────────────────────────
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['csat-settings'],
    queryFn: async () => {
      const { data } = await api.get('/csat/settings');
      return data.data as {
        is_enabled: boolean;
        message_template: string;
        delay_minutes: number;
      };
    },
  });

  const [settingsForm, setSettingsForm] = useState<{
    is_enabled: boolean;
    message_template: string;
    delay_minutes: number;
  } | null>(null);

  const currentSettings = settingsForm || settings;

  const saveSettingsMutation = useMutation({
    mutationFn: async (form: typeof settingsForm) => {
      await api.put('/csat/settings', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csat-settings'] });
      setSettingsForm(null);
      toast.success('CSAT settings disimpan');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menyimpan'),
  });

  // ─── Analytics ──────────────────────────────────
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['csat-analytics', timeRange],
    queryFn: async () => {
      const range = getDateRange();
      const params = new URLSearchParams();
      if (range.start_date) params.set('start_date', range.start_date);
      const { data } = await api.get(`/csat/analytics?${params.toString()}`);
      return data.data as {
        total: number;
        average: number;
        distribution: Record<number, number>;
        satisfaction_rate: number;
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CSAT (Kepuasan Pelanggan)</h1>
        <p className="text-sm text-muted-foreground">Survey kepuasan otomatis setelah percakapan di-resolve</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analitik</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Pengaturan</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Hari Terakhir</SelectItem>
                <SelectItem value="30">30 Hari Terakhir</SelectItem>
                <SelectItem value="90">90 Hari Terakhir</SelectItem>
                <SelectItem value="365">1 Tahun Terakhir</SelectItem>
                <SelectItem value="all">Semua Waktu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !analytics || analytics.total === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Belum ada data CSAT. Aktifkan survey di tab Pengaturan.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold">{analytics.average}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {STARS.map((s) => (
                        <Star key={s} className={cn('h-4 w-4', s <= Math.round(analytics.average) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')} />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Rata-rata Rating</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-green-600">{analytics.satisfaction_rate}%</div>
                    <p className="text-sm text-muted-foreground mt-1">Tingkat Kepuasan (4-5⭐)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold">{analytics.total}</div>
                    <p className="text-sm text-muted-foreground mt-1">Total Respons</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribusi Rating</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {STARS.map((s) => {
                    const count = analytics.distribution[s] || 0;
                    const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-28 shrink-0">
                          <span className="text-sm font-medium w-4">{s}</span>
                          <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs text-muted-foreground">{STAR_LABELS[s]}</span>
                        </div>
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', STAR_COLORS[s])} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium w-14 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  }).reverse()}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-6">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Aktifkan CSAT Survey</Label>
                    <p className="text-sm text-muted-foreground">Kirim survey otomatis setelah percakapan di-resolve</p>
                  </div>
                  <Switch
                    checked={currentSettings?.is_enabled || false}
                    onCheckedChange={(checked) => setSettingsForm({ ...(currentSettings || { is_enabled: false, message_template: '', delay_minutes: 5 }), is_enabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Delay Pengiriman (menit)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    value={currentSettings?.delay_minutes || 5}
                    onChange={(e) => setSettingsForm({ ...(currentSettings || { is_enabled: false, message_template: '', delay_minutes: 5 }), delay_minutes: parseInt(e.target.value) || 5 })}
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">Waktu tunggu setelah resolve sebelum survey dikirim</p>
                </div>

                <div className="space-y-2">
                  <Label>Template Pesan Survey</Label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px] resize-y"
                    value={currentSettings?.message_template || ''}
                    onChange={(e) => setSettingsForm({ ...(currentSettings || { is_enabled: false, message_template: '', delay_minutes: 5 }), message_template: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Pelanggan cukup balas dengan angka 1-5 untuk memberikan rating</p>
                </div>

                <Button
                  onClick={() => currentSettings && saveSettingsMutation.mutate(currentSettings as any)}
                  disabled={saveSettingsMutation.isPending || !settingsForm}
                >
                  {saveSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Pengaturan
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
