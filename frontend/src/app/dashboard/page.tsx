'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  MessageSquare,
  Handshake,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  Send,
  CheckCircle2,
  Circle,
  X,
  Smartphone,
  UserPlus,
  MessageCircle,
  Settings,
} from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useRouter } from 'next/navigation';

const COLORS = ['#687EFF', '#80B3FF', '#98E4FF', '#B6FFFA', '#a78bfa'];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [dismissedOnboarding, setDismissedOnboarding] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('onboarding_dismissed') === '1';
    return false;
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/dashboard');
      return data.data;
    },
  });

  const { data: messageVolume } = useQuery({
    queryKey: ['message-volume'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/messages/volume?days=14');
      return data.data;
    },
  });

  const { data: agentPerf } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/agents/performance');
      return data.data;
    },
  });

  const { data: contactGrowth } = useQuery({
    queryKey: ['contact-growth'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/contacts/growth?days=14');
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Kontak',
      value: formatNumber(dashboard?.contacts?.total || 0),
      change: `+${dashboard?.contacts?.new_today || 0} hari ini`,
      icon: Users,
      color: 'text-[#687EFF]',
      bg: 'bg-[#687EFF]/10',
      up: true,
    },
    {
      title: 'Percakapan Aktif',
      value: formatNumber(dashboard?.conversations?.open || 0),
      change: `${dashboard?.conversations?.total || 0} total`,
      icon: MessageSquare,
      color: 'text-[#80B3FF]',
      bg: 'bg-[#80B3FF]/10',
      up: true,
    },
    {
      title: 'Deals Terbuka',
      value: formatNumber(dashboard?.deals?.open || 0),
      change: `${dashboard?.deals?.won || 0} won`,
      icon: Handshake,
      color: 'text-[#98E4FF]',
      bg: 'bg-[#98E4FF]/10',
      up: true,
    },
    {
      title: 'Revenue (Won)',
      value: formatCurrency(dashboard?.deals?.won_revenue || 0),
      change: `${dashboard?.deals?.won || 0} deals closed`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      up: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4 text-emerald-500" />
          <span>{dashboard?.instances?.active || 0} instansi aktif</span>
        </div>
      </div>

      {/* Onboarding Checklist — shown for OWNER/ADMIN until dismissed */}
      {!dismissedOnboarding && user && (user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (() => {
        const steps = [
          {
            label: 'Hubungkan WhatsApp',
            done: (dashboard?.instances?.active || 0) > 0,
            icon: Smartphone,
            action: () => router.push('/dashboard/instances'),
          },
          {
            label: 'Tambah kontak pertama',
            done: (dashboard?.contacts?.total || 0) > 0,
            icon: UserPlus,
            action: () => router.push('/dashboard/contacts'),
          },
          {
            label: 'Kirim pesan pertama',
            done: (dashboard?.conversations?.total || 0) > 0,
            icon: MessageCircle,
            action: () => router.push('/dashboard/chat'),
          },
          {
            label: 'Atur auto-response',
            done: false, // no easy way to check without extra API, keep as suggestion
            icon: Settings,
            action: () => router.push('/dashboard/settings'),
          },
        ];
        const doneCount = steps.filter(s => s.done).length;
        if (doneCount >= steps.length) return null; // all done, auto-hide
        return (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">🚀 Selamat datang! Selesaikan setup awal</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{doneCount}/{steps.length} langkah selesai</p>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => { setDismissedOnboarding(true); localStorage.setItem('onboarding_dismissed', '1'); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {steps.map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    className="flex items-center gap-2.5 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={step.action}
                  >
                    {step.done
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                    <step.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className={`text-sm ${step.done ? 'line-through text-muted-foreground' : 'font-medium'}`}>{step.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                {kpi.up ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.change}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{kpi.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Message Volume Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Volume Pesan (14 Hari)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={messageVolume || []}>
                  <defs>
                    <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#687EFF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#687EFF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#80B3FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#80B3FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Area type="monotone" dataKey="incoming" stroke="#687EFF" fill="url(#colorIncoming)" name="Masuk" />
                  <Area type="monotone" dataKey="outgoing" stroke="#80B3FF" fill="url(#colorOutgoing)" name="Keluar" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Contact Growth Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Pertumbuhan Kontak (14 Hari)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contactGrowth?.daily || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" fill="#687EFF" radius={[4, 4, 0, 0]} name="Kontak Baru" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Agent Performance */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Performa Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(agentPerf || []).map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {agent.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <span className={`h-2 w-2 rounded-full ${agent.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm font-semibold">{agent.assigned_conversations}</p>
                      <p className="text-[10px] text-muted-foreground">Aktif</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{agent.resolved_conversations}</p>
                      <p className="text-[10px] text-muted-foreground">Selesai</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{agent.won_deals}</p>
                      <p className="text-[10px] text-muted-foreground">Won</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!agentPerf || agentPerf.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data agent</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sumber Kontak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contactGrowth?.by_source || []}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                    paddingAngle={3}
                  >
                    {(contactGrowth?.by_source || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {(contactGrowth?.by_source || []).map((s: any, i: number) => (
                <div key={s.source} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{s.source}</span>
                  </div>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
