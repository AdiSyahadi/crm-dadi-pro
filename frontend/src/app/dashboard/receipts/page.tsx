'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Receipt,
  FileText,
  Send,
  Ban,
  Trash2,
  MoreHorizontal,
  Search,
  Loader2,
  Eye,
  Plus,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmStore } from '@/stores/confirm.store';
import { ReceiptDialog } from '@/components/receipt-dialog';
import { Pencil } from 'lucide-react';

const RECEIPT_TYPES = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'donation', label: 'Donasi' },
  { key: 'zakat', label: 'Zakat' },
  { key: 'service', label: 'Layanan' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SENT: { label: 'Terkirim', variant: 'default' },
  FAILED: { label: 'Gagal', variant: 'destructive' },
  VOIDED: { label: 'Dibatalkan', variant: 'outline' },
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ReceiptItem {
  id: string;
  receipt_number: string;
  type: string;
  status: string;
  recipient_name: string;
  recipient_phone: string | null;
  total_amount: string | number;
  currency: string;
  payment_method: string | null;
  pdf_url: string | null;
  sent_via_wa: boolean;
  created_at: string;
  deal?: { id: string; title: string; deal_number: string } | null;
}

interface ReceiptSummary {
  total: number;
  draft: number;
  sent: number;
  voided: number;
  total_amount: number;
}

export default function ReceiptsPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const limit = 20;

  const openCreate = () => {
    setEditData(null);
    setDialogOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const { data } = await api.get(`/receipts/${id}`);
      setEditData(data.data);
      setDialogOpen(true);
    } catch {
      toast.error('Gagal memuat data kwitansi');
    }
  };

  const { data: summary } = useQuery<ReceiptSummary>({
    queryKey: ['receipts-summary'],
    queryFn: async () => {
      const { data } = await api.get('/receipts/summary');
      return data.data;
    },
  });

  const { data: receiptData, isLoading } = useQuery<{ data: ReceiptItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }>({
    queryKey: ['receipts', page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const { data } = await api.get(`/receipts?${params}`);
      return data;
    },
  });

  const receipts = receiptData?.data ?? [];
  const meta = receiptData?.meta;

  const voidMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/receipts/${id}/void`, { reason: 'Dibatalkan dari dashboard' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipts-summary'] });
      toast.success('Kwitansi berhasil dibatalkan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membatalkan kwitansi');
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/receipts/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipts-summary'] });
      toast.success('Kwitansi berhasil dikirim via WhatsApp');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengirim kwitansi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/receipts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipts-summary'] });
      toast.success('Kwitansi berhasil dihapus');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menghapus kwitansi');
    },
  });

  const handleVoid = (id: string) => {
    openConfirm({
      title: 'Batalkan Kwitansi?',
      description: 'Kwitansi yang dibatalkan tidak bisa dikembalikan.',
      onConfirm: () => voidMutation.mutate(id),
    });
  };

  const handleDelete = (id: string) => {
    openConfirm({
      title: 'Hapus Kwitansi?',
      description: 'Hanya kwitansi berstatus Draft yang bisa dihapus.',
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  const handleViewPdf = (pdfUrl: string | null) => {
    if (!pdfUrl) {
      toast.error('PDF belum tersedia');
      return;
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.open(`${baseUrl}${pdfUrl}`, '_blank');
  };

  const summaryCards = [
    { title: 'Total Kwitansi', value: summary?.total ?? 0, icon: FileText, color: 'text-blue-600' },
    { title: 'Draft', value: summary?.draft ?? 0, icon: Clock, color: 'text-gray-500' },
    { title: 'Terkirim', value: summary?.sent ?? 0, icon: CheckCircle2, color: 'text-green-600' },
    { title: 'Dibatalkan', value: summary?.voided ?? 0, icon: XCircle, color: 'text-red-500' },
    { title: 'Total Nominal', value: formatCurrency(summary?.total_amount ?? 0), icon: DollarSign, color: 'text-emerald-600', isAmount: true },
  ];

  return (
    <FeatureGate feature="deals">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Kwitansi</h1>
            <p className="text-sm text-muted-foreground">Kelola kwitansi, invoice, dan bukti pembayaran</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Buat Kwitansi
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                    <p className="text-xl font-bold mt-1">
                      {card.isAmount ? card.value : card.value}
                    </p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor, nama penerima..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Terkirim</SelectItem>
              <SelectItem value="FAILED">Gagal</SelectItem>
              <SelectItem value="VOIDED">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {RECEIPT_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : receipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Belum ada kwitansi</p>
                <p className="text-sm">Kwitansi akan muncul di sini setelah dibuat atau digenerate otomatis dari payment callback.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Kwitansi</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Penerima</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => {
                    const st = STATUS_MAP[r.status] || { label: r.status, variant: 'outline' as const };
                    const typeDef = RECEIPT_TYPES.find((t) => t.key === r.type);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.receipt_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{typeDef?.label || r.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{r.recipient_name}</p>
                            {r.recipient_phone && (
                              <p className="text-xs text-muted-foreground">{r.recipient_phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.deal ? (
                            <span className="text-xs text-muted-foreground">{r.deal.deal_number}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(r.total_amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(r.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewPdf(r.pdf_url)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Lihat PDF
                              </DropdownMenuItem>
                              {r.status === 'DRAFT' && (
                                <DropdownMenuItem onClick={() => openEdit(r.id)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {r.status === 'DRAFT' && (
                                <DropdownMenuItem onClick={() => sendMutation.mutate(r.id)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Kirim via WA
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {(r.status === 'DRAFT' || r.status === 'SENT') && (
                                <DropdownMenuItem onClick={() => handleVoid(r.id)} className="text-destructive">
                                  <Ban className="h-4 w-4 mr-2" />
                                  Batalkan
                                </DropdownMenuItem>
                              )}
                              {r.status === 'DRAFT' && (
                                <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Hapus
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Menampilkan {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} dari {meta.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      <ReceiptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editData={editData}
      />
    </FeatureGate>
  );
}
