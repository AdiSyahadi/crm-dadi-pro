'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, downloadCsv } from '@/lib/utils';
import { TaskDialog } from '@/components/task-dialog';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  TODO: { label: 'To Do', color: 'bg-slate-500' },
  IN_PROGRESS: { label: 'Sedang Dikerjakan', color: 'bg-blue-500' },
  DONE: { label: 'Selesai', color: 'bg-emerald-500' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-500' },
};

const TYPE_MAP: Record<string, string> = {
  FOLLOW_UP: 'Follow Up',
  CALL: 'Telepon',
  MEETING: 'Meeting',
  EMAIL: 'Email',
  OTHER: 'Lainnya',
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Rendah', color: 'text-slate-500' },
  MEDIUM: { label: 'Sedang', color: 'text-blue-500' },
  HIGH: { label: 'Tinggi', color: 'text-amber-500' },
  URGENT: { label: 'Urgent', color: 'text-red-500' },
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  due_date: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: { id: string; name: string; avatar_url: string | null } | null;
  assigned_to: { id: string; name: string; avatar_url: string | null } | null;
  contact: { id: string; name: string; phone_number: string } | null;
  deal: { id: string; title: string; deal_number: string; stage: string } | null;
}

export default function TasksPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');
  if (search) queryParams.set('search', search);
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (typeFilter !== 'all') queryParams.set('type', typeFilter);
  if (priorityFilter !== 'all') queryParams.set('priority', priorityFilter);
  queryParams.set('sort_by', sortBy);
  queryParams.set('sort_order', sortOrder);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', page, search, statusFilter, typeFilter, priorityFilter, sortBy, sortOrder],
    queryFn: async () => {
      const { data } = await api.get(`/tasks?${queryParams.toString()}`);
      return data as { data: Task[]; meta: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['tasks-summary'],
    queryFn: async () => {
      const { data } = await api.get('/tasks/summary');
      return data.data as { todo: number; in_progress: number; done: number; overdue: number };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-summary'] });
      toast.success('Tugas berhasil dihapus');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menghapus tugas');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-summary'] });
      toast.success('Status tugas diperbarui');
    },
  });

  const tasks = data?.data || [];
  const meta = data?.meta;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date) return false;
    if (task.status === 'DONE' || task.status === 'CANCELLED') return false;
    return new Date(task.due_date) < new Date();
  };

  return (
    <FeatureGate feature="deals">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tugas</h1>
            <p className="text-sm text-muted-foreground">Kelola tugas dan pengingat tim</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { downloadCsv('/export/tasks', 'tugas.csv').then(() => toast.success('Export berhasil')).catch(() => toast.error('Gagal export')); }}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => { setEditTask(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Tugas
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10">
                <ClipboardCheck className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.todo ?? 0}</p>
                <p className="text-xs text-muted-foreground">To Do</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.in_progress ?? 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.done ?? 0}</p>
                <p className="text-xs text-muted-foreground">Selesai</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.overdue ?? 0}</p>
                <p className="text-xs text-muted-foreground">Terlambat</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari tugas..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="DONE">Selesai</SelectItem>
              <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
              <SelectItem value="CALL">Telepon</SelectItem>
              <SelectItem value="MEETING">Meeting</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
              <SelectItem value="OTHER">Lainnya</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prioritas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Prioritas</SelectItem>
              <SelectItem value="LOW">Rendah</SelectItem>
              <SelectItem value="MEDIUM">Sedang</SelectItem>
              <SelectItem value="HIGH">Tinggi</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Belum ada tugas</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tugas</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipe</TableHead>
                    <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                      <span className="flex items-center">Prioritas<SortIcon field="priority" /></span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('due_date')}>
                      <span className="flex items-center">Tenggat<SortIcon field="due_date" /></span>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Ditugaskan</TableHead>
                    <TableHead className="hidden lg:table-cell">Kontak / Deal</TableHead>
                    <TableHead className="w-[50px]"><span className="sr-only">Aksi</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className={cn(isOverdue(task) && 'bg-red-50 dark:bg-red-950/20')}>
                      <TableCell>
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{task.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_MAP[task.type] || task.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={cn('text-xs font-medium', PRIORITY_MAP[task.priority]?.color)}>
                          {PRIORITY_MAP[task.priority]?.label || task.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(v) => updateStatusMutation.mutate({ id: task.id, status: v })}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-[140px]">
                            <div className="flex items-center gap-1.5">
                              <div className={cn('h-2 w-2 rounded-full', STATUS_MAP[task.status]?.color)} />
                              <span>{STATUS_MAP[task.status]?.label || task.status}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-1.5">
                                  <div className={cn('h-2 w-2 rounded-full', val.color)} />
                                  {val.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs', isOverdue(task) && 'text-red-600 font-semibold')}>
                          {formatDate(task.due_date)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs">{task.assigned_to?.name || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-xs">
                          {task.contact && <span>{task.contact.name}</span>}
                          {task.deal && <span className="text-muted-foreground">{task.contact ? ' • ' : ''}{task.deal.title}</span>}
                          {!task.contact && !task.deal && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditTask(task); setDialogOpen(true); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => openConfirm({
                                title: 'Hapus tugas ini?',
                                description: `Tugas "${task.title}" akan dihapus permanen.`,
                                confirmText: 'Hapus',
                                onConfirm: () => deleteMutation.mutate(task.id),
                              })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Halaman {meta.page} dari {meta.totalPages} ({meta.total} tugas)
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editTask}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['tasks-summary'] });
        }}
      />
    </FeatureGate>
  );
}
