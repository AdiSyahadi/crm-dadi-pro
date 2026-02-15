'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Handshake,
  TrendingUp,
  Trophy,
  XCircle,
  Loader2,
  DollarSign,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'QUALIFICATION', label: 'Kualifikasi', color: 'bg-blue-500' },
  { key: 'PROPOSAL', label: 'Proposal', color: 'bg-purple-500' },
  { key: 'NEGOTIATION', label: 'Negosiasi', color: 'bg-amber-500' },
  { key: 'CLOSING', label: 'Closing', color: 'bg-emerald-500' },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

interface Deal {
  id: string;
  title: string;
  deal_number: string;
  stage: string;
  value: string | number;
  contact: { id: string; name: string; phone_number: string } | null;
  assigned_to: { id: string; name: string } | null;
  closed_status: string | null;
  created_at: string;
}

export default function DealsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', contact_id: '', source: 'manual' });
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data } = await api.get('/deals?limit=100');
      return data.data as Deal[];
    },
  });

  const { data: report } = useQuery({
    queryKey: ['deal-report'],
    queryFn: async () => {
      const { data } = await api.get('/deals/report');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      await api.post('/deals', { ...input, value: Number(input.value) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-report'] });
      setDialogOpen(false);
      setForm({ title: '', value: '', contact_id: '', source: 'manual' });
      toast.success('Deal berhasil dibuat');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat deal');
    },
  });

  const moveStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      await api.post(`/deals/${id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Stage diperbarui');
    },
  });

  const markWonMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/deals/${id}/won`, { won_notes: 'Closed via pipeline' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-report'] });
      toast.success('Deal ditandai WON!');
    },
  });

  const markLostMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/deals/${id}/lost`, { lost_reason: 'Lost via pipeline' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-report'] });
      toast.success('Deal ditandai LOST');
    },
  });

  const openDeals = deals.filter((d) => !d.closed_status);
  const wonDeals = deals.filter((d) => d.closed_status === 'WON');
  const lostDeals = deals.filter((d) => d.closed_status === 'LOST');
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-muted-foreground">Pipeline dan closing tracker</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              variant={view === 'pipeline' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setView('pipeline')}
            >
              Pipeline
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setView('list')}
            >
              List
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Buat Deal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Deal Baru</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Judul Deal</Label>
                  <Input
                    placeholder="Paket Premium - John Doe"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nilai (IDR)</Label>
                  <Input
                    type="number"
                    placeholder="5000000"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Buat Deal
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Handshake className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openDeals.length}</p>
              <p className="text-xs text-muted-foreground">Deals Aktif</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{formatCurrency(totalPipelineValue)}</p>
              <p className="text-xs text-muted-foreground">Pipeline Value</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Trophy className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{wonDeals.length}</p>
              <p className="text-xs text-muted-foreground">Won ({formatCurrency(totalWonValue)})</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lostDeals.length}</p>
              <p className="text-xs text-muted-foreground">Lost</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Board */}
      {view === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageDeals = openDeals.filter((d) => d.stage === stage.key);
            const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);

            return (
              <div key={stage.key} className="flex-shrink-0 w-[300px]">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-3 w-3 rounded-full', stage.color)} />
                      <h3 className="text-sm font-semibold">{stage.label}</h3>
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {stageDeals.length}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatCurrency(stageValue)}</span>
                  </div>

                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {stageDeals.map((deal) => (
                        <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{deal.title}</p>
                                <p className="text-[10px] text-muted-foreground">{deal.deal_number}</p>
                              </div>
                              <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                            </div>
                            <p className="text-sm font-semibold text-primary">{formatCurrency(Number(deal.value))}</p>
                            {deal.contact && (
                              <p className="text-xs text-muted-foreground mt-1">{deal.contact.name}</p>
                            )}
                            <div className="flex items-center gap-1 mt-2">
                              {/* Stage navigation buttons */}
                              {stage.key !== 'QUALIFICATION' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => {
                                    const idx = STAGES.findIndex((s) => s.key === stage.key);
                                    if (idx > 0) moveStageMutation.mutate({ id: deal.id, stage: STAGES[idx - 1].key });
                                  }}
                                >
                                  ← Back
                                </Button>
                              )}
                              {stage.key !== 'CLOSING' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => {
                                    const idx = STAGES.findIndex((s) => s.key === stage.key);
                                    if (idx < STAGES.length - 1) moveStageMutation.mutate({ id: deal.id, stage: STAGES[idx + 1].key });
                                  }}
                                >
                                  Next →
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 text-emerald-600"
                                    onClick={() => markWonMutation.mutate(deal.id)}
                                  >
                                    ✓ Won
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 text-red-600"
                                    onClick={() => markLostMutation.mutate(deal.id)}
                                  >
                                    ✗ Lost
                                  </Button>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          Tidak ada deal
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{deal.title}</p>
                      <Badge variant="outline" className="text-[10px]">{deal.deal_number}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {deal.contact?.name || 'No contact'} • {deal.stage}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(Number(deal.value))}</p>
                  {deal.closed_status && (
                    <Badge className={cn(
                      'text-[10px]',
                      deal.closed_status === 'WON' ? 'bg-emerald-500' : 'bg-red-500'
                    )}>
                      {deal.closed_status}
                    </Badge>
                  )}
                </div>
              ))}
              {deals.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Belum ada deal</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
