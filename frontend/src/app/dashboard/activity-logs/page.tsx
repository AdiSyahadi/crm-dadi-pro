'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { History, Search, Loader2, ChevronLeft, ChevronRight, User, Users, Handshake, MessageSquare, FileText, Settings, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { downloadCsv } from '@/lib/utils';

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  contact: Users,
  deal: Handshake,
  conversation: MessageSquare,
  template: FileText,
  user: User,
  settings: Settings,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  contact_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  user: { id: string; name: string; email: string } | null;
}

export default function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs', page, entityTypeFilter, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sort_order: sortOrder });
      if (entityTypeFilter !== 'all') params.set('entity_type', entityTypeFilter);
      const { data } = await api.get(`/activity-logs?${params}`);
      return data as { data: ActivityLog[]; meta: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const getActionColor = (action: string) => {
    const key = Object.keys(ACTION_COLORS).find((k) => action.toLowerCase().includes(k));
    return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const EntityIcon = ({ type }: { type: string }) => {
    const Icon = ENTITY_ICONS[type.toLowerCase()] || History;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Log Aktivitas
          </h1>
          <p className="text-muted-foreground text-sm">Riwayat semua perubahan dan tindakan di CRM</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { downloadCsv('/export/activity-logs', 'activity-logs.csv').then(() => toast.success('Export berhasil')).catch(() => toast.error('Gagal export')); }}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Semua Entitas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Entitas</SelectItem>
            <SelectItem value="contact">Kontak</SelectItem>
            <SelectItem value="deal">Deal</SelectItem>
            <SelectItem value="conversation">Percakapan</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="broadcast">Broadcast</SelectItem>
            <SelectItem value="task">Tugas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as 'asc' | 'desc'); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Urutkan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Terbaru</SelectItem>
            <SelectItem value="asc">Terlama</SelectItem>
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
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Belum ada aktivitas</p>
              <p className="text-sm">Log akan muncul setelah ada tindakan di CRM</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead className="hidden sm:table-cell">Entitas</TableHead>
                  <TableHead className="hidden md:table-cell">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{log.user?.name || 'Sistem'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActionColor(log.action)} variant="secondary">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <EntityIcon type={log.entity_type} />
                        <span className="text-sm capitalize">{log.entity_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {log.details && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                          {typeof log.details === 'object' ? JSON.stringify(log.details).slice(0, 80) : String(log.details)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {meta.page} dari {meta.totalPages} ({meta.total} log)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
