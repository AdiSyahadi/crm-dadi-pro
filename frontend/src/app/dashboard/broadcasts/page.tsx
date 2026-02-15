'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Send, Plus, Play, Pause, XCircle, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  SCHEDULED: { label: 'Terjadwal', color: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Mengirim', color: 'bg-amber-100 text-amber-700' },
  PAUSED: { label: 'Dijeda', color: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  FAILED: { label: 'Gagal', color: 'bg-red-100 text-red-700' },
};

export default function BroadcastsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: async () => {
      const { data } = await api.get('/broadcasts?limit=50');
      return data;
    },
  });

  const broadcasts = data?.data || [];

  const startMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/broadcasts/${id}/start`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dimulai');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal'),
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/broadcasts/${id}/pause`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dijeda');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/broadcasts/${id}/cancel`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dibatalkan');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Broadcast</h1>
          <p className="text-sm text-muted-foreground">Kirim pesan massal ke kontak WhatsApp</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Broadcast
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{broadcasts.length}</p>
              <p className="text-xs text-muted-foreground">Total Broadcast</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Radio className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{broadcasts.filter((b: any) => b.status === 'SENDING').length}</p>
              <p className="text-xs text-muted-foreground">Sedang Mengirim</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Send className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{broadcasts.filter((b: any) => b.status === 'COMPLETED').length}</p>
              <p className="text-xs text-muted-foreground">Selesai</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Send className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {broadcasts.reduce((sum: number, b: any) => sum + (b.sent_count || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Pesan Terkirim</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Penerima</TableHead>
                <TableHead className="hidden md:table-cell">Terkirim</TableHead>
                <TableHead className="hidden lg:table-cell">Gagal</TableHead>
                <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
                <TableHead className="w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : broadcasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Belum ada broadcast
                  </TableCell>
                </TableRow>
              ) : (
                broadcasts.map((bc: any) => {
                  const sc = statusConfig[bc.status] || statusConfig.DRAFT;
                  return (
                    <TableRow key={bc.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{bc.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {bc.instance?.name || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-[10px]', sc.color)}>
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {bc.total_recipients || bc._count?.recipients || 0}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-emerald-600">
                        {bc.sent_count || 0}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-red-500">
                        {bc.failed_count || 0}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(bc.created_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(bc.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600"
                              onClick={() => startMutation.mutate(bc.id)}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {bc.status === 'SENDING' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600"
                              onClick={() => pauseMutation.mutate(bc.id)}
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(bc.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              onClick={() => cancelMutation.mutate(bc.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
