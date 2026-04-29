'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3, TrendingUp, Users, MessageSquare, Download, DollarSign, Target, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

/* ── Forecasting types ── */
interface ForecastData {
  pipeline: {
    total_deals: number;
    total_value: number;
    weighted_value: number;
    stage_breakdown: Record<string, { count: number; value: number; weighted: number }>;
  };
  win_rate: { last_30_days: number; last_60_days: number; last_90_days: number; won_30: number; lost_30: number };
  revenue: { last_30_days: number; last_60_days: number; last_90_days: number; monthly_average: number };
  forecast: { projected_revenue_30d: number; weighted_pipeline: number; trend_based: number };
  closing_soon: Array<{
    id: string; title: string; deal_number: string; stage: string;
    value: string | number; expected_close_date: string | null;
    win_probability: number; contact: { name: string } | null; assigned_to: { name: string } | null;
  }>;
}

const stageLabels: Record<string, string> = {
  QUALIFICATION: 'Kualifikasi', PROPOSAL: 'Proposal', NEGOTIATION: 'Negosiasi', CLOSING: 'Penutupan',
};
const stageColors: Record<string, string> = {
  QUALIFICATION: '#94a3b8', PROPOSAL: '#60a5fa', NEGOTIATION: '#f59e0b', CLOSING: '#22c55e',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const DATE_SHORTCUTS = [
    { label: '7 Hari', value: 7 },
    { label: '14 Hari', value: 14 },
    { label: '30 Hari', value: 30 },
    { label: '60 Hari', value: 60 },
    { label: '90 Hari', value: 90 },
  ];

  /* ── Queries ── */
  const { data: messageVolume, isLoading: loadingMsg } = useQuery({
    queryKey: ['analytics-msg-volume', days],
    queryFn: async () => { const { data } = await api.get(`/analytics/messages/volume?days=${days}`); return data.data; },
  });
  const { data: contactGrowth, isLoading: loadingContact } = useQuery({
    queryKey: ['analytics-contact-growth', days],
    queryFn: async () => { const { data } = await api.get(`/analytics/contacts/growth?days=${days}`); return data.data; },
  });
  const { data: agentPerf, isLoading: loadingAgent } = useQuery({
    queryKey: ['analytics-agent-perf'],
    queryFn: async () => { const { data } = await api.get('/analytics/agents/performance'); return data.data; },
  });
  const { data: forecast, isLoading: loadingForecast } = useQuery<ForecastData>({
    queryKey: ['deals-forecast'],
    queryFn: async () => { const { data } = await api.get('/deals/forecast'); return data.data; },
  });

  const isLoading = loadingMsg || loadingContact || loadingAgent;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analitik</h1>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const totalMsgVolume = (messageVolume || []).reduce((s: number, d: any) => s + d.total, 0);
  const totalIncoming = (messageVolume || []).reduce((s: number, d: any) => s + d.incoming, 0);
  const totalOutgoing = (messageVolume || []).reduce((s: number, d: any) => s + d.outgoing, 0);
  const totalNewContacts = (contactGrowth?.daily || []).reduce((s: number, d: any) => s + d.count, 0);

  const downloadCsv = async (type: 'conversations' | 'contacts' | 'deals') => {
    try {
      const { data } = await api.get(`/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Export ${type} berhasil diunduh`);
    } catch {
      toast.error(`Gagal export ${type}`);
    }
  };

  const stageChartData = forecast
    ? Object.entries(forecast.pipeline.stage_breakdown).map(([stage, info]) => ({
        name: stageLabels[stage] || stage, stage, value: info.weighted, count: info.count, total: info.value,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analitik</h1>
          <p className="text-sm text-muted-foreground">Statistik dan performa {days} hari terakhir</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {DATE_SHORTCUTS.map((s) => (
              <Badge
                key={s.value}
                variant={days === s.value ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setDays(s.value)}
              >
                {s.label}
              </Badge>
            ))}
          </div>
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadCsv('conversations')}>Export Percakapan</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadCsv('contacts')}>Export Kontak</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadCsv('deals')}>Export Deals</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMsgVolume}</p>
              <p className="text-xs text-muted-foreground">Total Pesan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalIncoming}</p>
              <p className="text-xs text-muted-foreground">Pesan Masuk</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOutgoing}</p>
              <p className="text-xs text-muted-foreground">Pesan Keluar</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalNewContacts}</p>
              <p className="text-xs text-muted-foreground">Kontak Baru</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pesan">
        <TabsList>
          <TabsTrigger value="pesan">Pesan</TabsTrigger>
          <TabsTrigger value="kontak">Kontak</TabsTrigger>
          <TabsTrigger value="penjualan">Penjualan</TabsTrigger>
          <TabsTrigger value="tim">Tim</TabsTrigger>
        </TabsList>

        {/* ═══ Tab: Pesan ═══ */}
        <TabsContent value="pesan">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Volume Pesan Harian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={messageVolume || []}>
                    <defs>
                      <linearGradient id="aIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#687EFF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#687EFF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="aOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#80B3FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#80B3FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="incoming" stroke="#687EFF" fill="url(#aIn)" name="Masuk" />
                    <Area type="monotone" dataKey="outgoing" stroke="#80B3FF" fill="url(#aOut)" name="Keluar" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Kontak ═══ */}
        <TabsContent value="kontak">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Pertumbuhan Kontak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contactGrowth?.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="count" fill="#687EFF" radius={[4, 4, 0, 0]} name="Kontak Baru" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab: Penjualan (Forecasting) ═══ */}
        <TabsContent value="penjualan">
          {loadingForecast ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !forecast ? (
            <p className="text-center text-muted-foreground py-10">Data penjualan tidak tersedia</p>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-100 p-2"><DollarSign className="h-5 w-5 text-blue-600" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pipeline Tertimbang</p>
                        <p className="text-xl font-bold">{formatCurrency(forecast.pipeline.weighted_value)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-green-100 p-2"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Proyeksi 30 Hari</p>
                        <p className="text-xl font-bold">{formatCurrency(forecast.forecast.projected_revenue_30d)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-amber-100 p-2"><Target className="h-5 w-5 text-amber-600" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Win Rate (30h)</p>
                        <p className="text-xl font-bold">{forecast.win_rate.last_30_days}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-purple-100 p-2"><DollarSign className="h-5 w-5 text-purple-600" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue Rata-rata/Bulan</p>
                        <p className="text-xl font-bold">{formatCurrency(forecast.revenue.monthly_average)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Pipeline Chart */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Pipeline per Tahap (Tertimbang)</CardTitle></CardHeader>
                  <CardContent>
                    {stageChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stageChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatCurrency(v)} />
                          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {stageChartData.map((entry) => (
                              <Cell key={entry.stage} fill={stageColors[entry.stage] || '#94a3b8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-10">Belum ada deal di pipeline</p>
                    )}
                  </CardContent>
                </Card>

                {/* Revenue & Win Rate */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Revenue & Win Rate</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">30 Hari</p>
                        <p className="text-lg font-bold">{formatCurrency(forecast.revenue.last_30_days)}</p>
                        <p className="text-xs text-green-600">WR {forecast.win_rate.last_30_days}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">60 Hari</p>
                        <p className="text-lg font-bold">{formatCurrency(forecast.revenue.last_60_days)}</p>
                        <p className="text-xs text-green-600">WR {forecast.win_rate.last_60_days}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">90 Hari</p>
                        <p className="text-lg font-bold">{formatCurrency(forecast.revenue.last_90_days)}</p>
                        <p className="text-xs text-green-600">WR {forecast.win_rate.last_90_days}%</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Ringkasan Proyeksi</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pipeline Tertimbang</span>
                          <span className="font-medium">{formatCurrency(forecast.forecast.weighted_pipeline)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tren Pendapatan</span>
                          <span className="font-medium">{formatCurrency(forecast.forecast.trend_based)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-medium">Total Proyeksi 30h</span>
                          <span className="font-bold text-green-600">{formatCurrency(forecast.forecast.projected_revenue_30d)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground">Won: {forecast.win_rate.won_30} | Lost: {forecast.win_rate.lost_30} (30 hari terakhir)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Closing Soon */}
              {forecast.closing_soon.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4" /> Deal Segera Closing (30 Hari)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium">Deal</th>
                            <th className="pb-2 font-medium">Tahap</th>
                            <th className="pb-2 font-medium">Nilai</th>
                            <th className="pb-2 font-medium">Probabilitas</th>
                            <th className="pb-2 font-medium">Tgl Closing</th>
                            <th className="pb-2 font-medium">Kontak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecast.closing_soon.map((deal) => (
                            <tr key={deal.id} className="border-b last:border-0">
                              <td className="py-2">
                                <span className="font-medium">{deal.title}</span>
                                <span className="text-xs text-muted-foreground ml-1">#{deal.deal_number}</span>
                              </td>
                              <td className="py-2">
                                <span className={cn(
                                  'px-2 py-0.5 rounded-full text-xs font-medium',
                                  deal.stage === 'CLOSING' && 'bg-green-100 text-green-700',
                                  deal.stage === 'NEGOTIATION' && 'bg-amber-100 text-amber-700',
                                  deal.stage === 'PROPOSAL' && 'bg-blue-100 text-blue-700',
                                  deal.stage === 'QUALIFICATION' && 'bg-gray-100 text-gray-700'
                                )}>
                                  {stageLabels[deal.stage] || deal.stage}
                                </span>
                              </td>
                              <td className="py-2">{formatCurrency(Number(deal.value || 0))}</td>
                              <td className="py-2">{deal.win_probability}%</td>
                              <td className="py-2">{deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('id-ID') : '-'}</td>
                              <td className="py-2">{deal.contact?.name || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ═══ Tab: Tim ═══ */}
        <TabsContent value="tim">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Beban Kerja &amp; Performa Tim</CardTitle>
            </CardHeader>
            <CardContent>
              {(agentPerf || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data agent</p>
              ) : (
                <div className="space-y-3">
                  {(agentPerf || []).map((agent: any) => (
                    <div key={agent.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                          {agent.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{agent.name}</p>
                            <span className={`h-2 w-2 rounded-full shrink-0 ${agent.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                          </div>
                          <p className="text-xs text-muted-foreground">{agent.role}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-4 sm:gap-6 text-center sm:ml-auto">
                        <div>
                          <p className="text-sm font-semibold">{agent.assigned_conversations}</p>
                          <p className="text-[10px] text-muted-foreground">Chat Aktif</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{agent.pending_tasks ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Tugas</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{agent.resolved_conversations}</p>
                          <p className="text-[10px] text-muted-foreground">Selesai</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{agent.sent_messages}</p>
                          <p className="text-[10px] text-muted-foreground">Pesan</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{agent.won_deals}</p>
                          <p className="text-[10px] text-muted-foreground">Won</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
