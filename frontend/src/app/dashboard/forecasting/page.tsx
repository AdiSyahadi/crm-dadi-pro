'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Target, DollarSign, Clock, CalendarCheck } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ForecastData {
  pipeline: {
    total_deals: number;
    total_value: number;
    weighted_value: number;
    stage_breakdown: Record<string, { count: number; value: number; weighted: number }>;
  };
  win_rate: {
    last_30_days: number;
    last_60_days: number;
    last_90_days: number;
    won_30: number;
    lost_30: number;
  };
  revenue: {
    last_30_days: number;
    last_60_days: number;
    last_90_days: number;
    monthly_average: number;
  };
  forecast: {
    projected_revenue_30d: number;
    weighted_pipeline: number;
    trend_based: number;
  };
  closing_soon: Array<{
    id: string;
    title: string;
    deal_number: string;
    stage: string;
    value: string | number;
    expected_close_date: string | null;
    win_probability: number;
    contact: { name: string } | null;
    assigned_to: { name: string } | null;
  }>;
}

const stageLabels: Record<string, string> = {
  QUALIFICATION: 'Kualifikasi',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negosiasi',
  CLOSING: 'Penutupan',
};

const stageColors: Record<string, string> = {
  QUALIFICATION: '#94a3b8',
  PROPOSAL: '#60a5fa',
  NEGOTIATION: '#f59e0b',
  CLOSING: '#22c55e',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
}

export default function ForecastingPage() {
  const { data, isLoading } = useQuery<ForecastData>({
    queryKey: ['deals-forecast'],
    queryFn: async () => {
      const { data } = await api.get('/deals/forecast');
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Sales Forecasting</h1>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stageChartData = Object.entries(data.pipeline.stage_breakdown).map(([stage, info]) => ({
    name: stageLabels[stage] || stage,
    stage,
    value: info.weighted,
    count: info.count,
    total: info.value,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sales Forecasting</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Tertimbang</p>
                <p className="text-xl font-bold">{formatCurrency(data.pipeline.weighted_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Proyeksi 30 Hari</p>
                <p className="text-xl font-bold">{formatCurrency(data.forecast.projected_revenue_30d)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate (30h)</p>
                <p className="text-xl font-bold">{data.win_rate.last_30_days}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Revenue Rata-rata/Bulan</p>
                <p className="text-xl font-bold">{formatCurrency(data.revenue.monthly_average)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline per Tahap (Tertimbang)</CardTitle>
          </CardHeader>
          <CardContent>
            {stageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
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

        {/* Win Rate & Revenue Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue & Win Rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">30 Hari</p>
                <p className="text-lg font-bold">{formatCurrency(data.revenue.last_30_days)}</p>
                <p className="text-xs text-green-600">WR {data.win_rate.last_30_days}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">60 Hari</p>
                <p className="text-lg font-bold">{formatCurrency(data.revenue.last_60_days)}</p>
                <p className="text-xs text-green-600">WR {data.win_rate.last_60_days}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">90 Hari</p>
                <p className="text-lg font-bold">{formatCurrency(data.revenue.last_90_days)}</p>
                <p className="text-xs text-green-600">WR {data.win_rate.last_90_days}%</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Ringkasan Proyeksi</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pipeline Tertimbang</span>
                  <span className="font-medium">{formatCurrency(data.forecast.weighted_pipeline)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tren Pendapatan</span>
                  <span className="font-medium">{formatCurrency(data.forecast.trend_based)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total Proyeksi 30h</span>
                  <span className="font-bold text-green-600">{formatCurrency(data.forecast.projected_revenue_30d)}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Won: {data.win_rate.won_30} | Lost: {data.win_rate.lost_30} (30 hari terakhir)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closing Soon Table */}
      {data.closing_soon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Deal Segera Closing (30 Hari)
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
                  {data.closing_soon.map((deal) => (
                    <tr key={deal.id} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{deal.title}</span>
                        <span className="text-xs text-muted-foreground ml-1">#{deal.deal_number}</span>
                      </td>
                      <td className="py-2">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            deal.stage === 'CLOSING' && 'bg-green-100 text-green-700',
                            deal.stage === 'NEGOTIATION' && 'bg-amber-100 text-amber-700',
                            deal.stage === 'PROPOSAL' && 'bg-blue-100 text-blue-700',
                            deal.stage === 'QUALIFICATION' && 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {stageLabels[deal.stage] || deal.stage}
                        </span>
                      </td>
                      <td className="py-2">{formatCurrency(Number(deal.value || 0))}</td>
                      <td className="py-2">{deal.win_probability}%</td>
                      <td className="py-2">
                        {deal.expected_close_date
                          ? new Date(deal.expected_close_date).toLocaleDateString('id-ID')
                          : '-'}
                      </td>
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
  );
}
