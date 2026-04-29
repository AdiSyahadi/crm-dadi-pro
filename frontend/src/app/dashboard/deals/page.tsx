'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Handshake,
  TrendingUp,
  Trophy,
  XCircle,
  Loader2,
  DollarSign,
  GripVertical,
  User,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, downloadCsv } from '@/lib/utils';
import { DealDetailDialog } from '@/components/deal-detail-dialog';

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
  payment_status: string | null;
  midtrans_snap_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function DealsPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', contact_id: '', source: 'manual' });
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [detailDealId, setDetailDealId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lostDialogDealId, setLostDialogDealId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === deals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deals.map((d) => d.id)));
    }
  };

  const bulkAction = async (action: 'stage' | 'won' | 'lost' | 'delete', stage?: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        if (action === 'stage' && stage) await api.post(`/deals/${id}/stage`, { stage });
        if (action === 'won') await api.post(`/deals/${id}/won`, { won_notes: 'Bulk closed' });
        if (action === 'lost') await api.post(`/deals/${id}/lost`, { lost_reason: 'Bulk closed' });
        if (action === 'delete') await api.delete(`/deals/${id}`);
      }
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success(`${selectedIds.size} deal berhasil diproses`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Sebagian operasi gagal');
    } finally {
      setBulkLoading(false);
    }
  };

  const openDealDetail = (id: string) => {
    setDetailDealId(id);
    setDetailOpen(true);
  };

  const { data: rottenSettings } = useQuery({
    queryKey: ['rotten-deal-settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings/rotten-deals');
      return data.data as { rotten_deal_days: number };
    },
  });

  const rottenDays = rottenSettings?.rotten_deal_days ?? 7;

  const isRotten = (deal: Deal) => {
    if (rottenDays <= 0) return false;
    if (deal.closed_status) return false;
    const daysSince = (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= rottenDays;
  };

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals', search, filterStage, filterStatus, page, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(view === 'pipeline' ? 100 : limit));
      if (search) params.set('search', search);
      if (filterStage !== 'all') params.set('stage', filterStage);
      if (filterStatus === 'WON') params.set('closed_status', 'WON');
      if (filterStatus === 'LOST') params.set('closed_status', 'LOST');
      if (filterStatus === 'open') {
        // Open means no closed_status — backend default
      }
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);
      const { data } = await api.get(`/deals?${params.toString()}`);
      return data as { data: Deal[]; meta: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const deals = dealsData?.data ?? [];
  const meta = dealsData?.meta;

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-for-deal'],
    queryFn: async () => {
      const { data } = await api.get('/contacts?limit=200');
      return data.data as { id: string; name: string; phone_number: string }[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      await api.post('/deals', { ...input, value: Number(input.value) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
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
      toast.success('Deal ditandai WON!');
    },
  });

  const markLostMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/deals/${id}/lost`, { lost_reason: reason || 'Tidak ada alasan' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal ditandai LOST');
      setLostDialogDealId(null);
      setLostReason('');
    },
  });

  const openDeals = deals.filter((d) => !d.closed_status);
  const wonDeals = deals.filter((d) => d.closed_status === 'WON');
  const lostDeals = deals.filter((d) => d.closed_status === 'LOST');
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);

  return (
    <FeatureGate feature="deals">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-muted-foreground">Pipeline dan closing tracker</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { downloadCsv('/export/deals', 'deals.csv').then(() => toast.success('Export berhasil')).catch(() => toast.error('Gagal export')); }}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
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
                  if (!form.contact_id) {
                    toast.error('Pilih kontak terlebih dahulu');
                    return;
                  }
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
                  <Label>Kontak</Label>
                  <Select
                    value={form.contact_id}
                    onValueChange={(v) => setForm({ ...form, contact_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kontak..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {c.name || c.phone_number}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari deal, nomor, atau kontak..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={filterStage} onValueChange={(v) => { setFilterStage(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Semua Tahap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahap</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="WON">Won</SelectItem>
            <SelectItem value="LOST">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={`${sortBy}:${sortOrder}`} onValueChange={(v) => { const [f, o] = v.split(':'); setSortBy(f); setSortOrder(o as 'asc' | 'desc'); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Urutkan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Terbaru</SelectItem>
            <SelectItem value="created_at:asc">Terlama</SelectItem>
            <SelectItem value="value:desc">Nilai Tertinggi</SelectItem>
            <SelectItem value="value:asc">Nilai Terendah</SelectItem>
            <SelectItem value="updated_at:desc">Terakhir Update</SelectItem>
            <SelectItem value="expected_close_date:asc">Close Terdekat</SelectItem>
          </SelectContent>
        </Select>
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
                        <Card key={deal.id} className={cn('cursor-pointer hover:shadow-md transition-shadow', isRotten(deal) && 'border-amber-400 bg-amber-50/50')} onClick={() => openDealDetail(deal.id)}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <p className="text-sm font-medium truncate">{deal.title}</p>
                                  {isRotten(deal) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{deal.deal_number}</p>
                              </div>
                              <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                            </div>
                            <p className="text-sm font-semibold text-primary">{formatCurrency(Number(deal.value))}</p>
                            {deal.contact && (
                              <p className="text-xs text-muted-foreground mt-1">{deal.contact.name}</p>
                            )}
                            {deal.payment_status && (
                              <Badge variant="outline" className={cn('text-[10px] mt-1 gap-1', deal.payment_status === 'settlement' ? 'border-emerald-300 text-emerald-600' : deal.payment_status === 'pending' ? 'border-amber-300 text-amber-600' : 'border-gray-300 text-gray-500')}>
                                <CreditCard className="h-2.5 w-2.5" />
                                {deal.payment_status === 'settlement' ? 'Lunas' : deal.payment_status === 'pending' ? 'Menunggu' : deal.payment_status}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
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
                                    onClick={() => { setLostDialogDealId(deal.id); setLostReason(''); }}
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
          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 border-b">
              <span className="text-sm font-medium">{selectedIds.size} dipilih</span>
              <Select onValueChange={(v) => openConfirm({ title: `Pindahkan ${selectedIds.size} deal?`, description: `Semua deal terpilih akan dipindah ke tahap baru.`, confirmText: 'Pindahkan', onConfirm: () => bulkAction('stage', v) })}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Pindah Stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-600" disabled={bulkLoading} onClick={() => openConfirm({ title: `Tandai ${selectedIds.size} deal sebagai Won?`, confirmText: 'Ya, Won', onConfirm: () => bulkAction('won') })}>
                ✓ Won
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs text-red-600" disabled={bulkLoading} onClick={() => openConfirm({ title: `Tandai ${selectedIds.size} deal sebagai Lost?`, confirmText: 'Ya, Lost', onConfirm: () => bulkAction('lost') })}>
                ✗ Lost
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs text-destructive" disabled={bulkLoading} onClick={() => openConfirm({ title: `Hapus ${selectedIds.size} deal?`, description: 'Aksi ini tidak bisa dibatalkan.', confirmText: 'Hapus', variant: 'destructive', onConfirm: () => bulkAction('delete') })}>
                Hapus
              </Button>
              {bulkLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          )}
          <CardContent className="p-0">
            <div className="divide-y">
              {/* Select All */}
              <div className="flex items-center gap-3 p-3 bg-muted/20">
                <Checkbox checked={deals.length > 0 && selectedIds.size === deals.length} onCheckedChange={toggleAll} />
                <span className="text-xs text-muted-foreground">Pilih semua</span>
              </div>
              {deals.map((deal) => (
                <div key={deal.id} className={cn('flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer', isRotten(deal) && 'bg-amber-50/50', selectedIds.has(deal.id) && 'bg-primary/5')} onClick={() => openDealDetail(deal.id)}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(deal.id)} onCheckedChange={() => toggleSelect(deal.id)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isRotten(deal) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      <p className="text-sm font-medium">{deal.title}</p>
                      <Badge variant="outline" className="text-[10px]">{deal.deal_number}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {deal.contact?.name || 'No contact'} • {deal.stage}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(Number(deal.value))}</p>
                  {deal.payment_status && (
                    <Badge variant="outline" className={cn('text-[10px] gap-1', deal.payment_status === 'settlement' ? 'border-emerald-300 text-emerald-600' : deal.payment_status === 'pending' ? 'border-amber-300 text-amber-600' : 'border-gray-300 text-gray-500')}>
                      <CreditCard className="h-2.5 w-2.5" />
                      {deal.payment_status === 'settlement' ? 'Lunas' : deal.payment_status === 'pending' ? 'Menunggu' : deal.payment_status}
                    </Badge>
                  )}
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

      {/* Pagination */}
      {view === 'list' && meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {deals.length} dari {meta.total} deal
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>

    <DealDetailDialog
      open={detailOpen}
      onOpenChange={setDetailOpen}
      dealId={detailDealId}
    />

    <Dialog open={!!lostDialogDealId} onOpenChange={(open) => { if (!open) { setLostDialogDealId(null); setLostReason(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tandai Deal sebagai Lost</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="lost-reason">Alasan Kalah / Gagal</Label>
          <Textarea
            id="lost-reason"
            placeholder="Contoh: Harga terlalu mahal, kompetitor menawarkan lebih murah..."
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setLostDialogDealId(null); setLostReason(''); }}>Batal</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={markLostMutation.isPending}
              onClick={() => { if (lostDialogDealId) markLostMutation.mutate({ id: lostDialogDealId, reason: lostReason }); }}
            >
              {markLostMutation.isPending ? 'Memproses...' : 'Ya, Tandai Lost'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </FeatureGate>
  );
}
