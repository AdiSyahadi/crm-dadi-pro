'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';
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
  LineChart,
  Line,
} from 'recharts';

export default function AnalyticsPage() {
  const { data: messageVolume, isLoading: loadingMsg } = useQuery({
    queryKey: ['analytics-msg-volume'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/messages/volume?days=30');
      return data.data;
    },
  });

  const { data: contactGrowth, isLoading: loadingContact } = useQuery({
    queryKey: ['analytics-contact-growth'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/contacts/growth?days=30');
      return data.data;
    },
  });

  const { data: agentPerf, isLoading: loadingAgent } = useQuery({
    queryKey: ['analytics-agent-perf'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/agents/performance');
      return data.data;
    },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analitik</h1>
        <p className="text-sm text-muted-foreground">Statistik dan performa 30 hari terakhir</p>
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

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Performa Agent</CardTitle>
        </CardHeader>
        <CardContent>
          {(agentPerf || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada data agent</p>
          ) : (
            <div className="space-y-3">
              {(agentPerf || []).map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                    {agent.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{agent.name}</p>
                      <span className={`h-2 w-2 rounded-full ${agent.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-6 text-center">
                    <div>
                      <p className="text-sm font-semibold">{agent.assigned_conversations}</p>
                      <p className="text-[10px] text-muted-foreground">Aktif</p>
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
    </div>
  );
}
