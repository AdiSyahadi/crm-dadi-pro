'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  CalendarDays,
  Plus,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  MapPin,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadCsv } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Terjadwal',
  CONFIRMED: 'Dikonfirmasi',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  NO_SHOW: 'Tidak Hadir',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  location: '',
  start_time: '',
  end_time: '',
  contact_id: '',
  assigned_to_id: '',
  notes: '',
  status: 'SCHEDULED',
};

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20', sort_by: 'start_time', sort_order: 'asc' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const { data } = await api.get(`/appointments?${params}`);
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-mini'],
    queryFn: async () => {
      const { data } = await api.get('/contacts?limit=200');
      return data.data || [];
    },
  });

  const { data: teamMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await api.get('/teams/members');
      return data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/appointments', body),
    onSuccess: () => {
      toast.success('Appointment berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Gagal membuat appointment'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/appointments/${id}`, body),
    onSuccess: () => {
      toast.success('Appointment berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Gagal memperbarui appointment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: () => {
      toast.success('Appointment berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => toast.error('Gagal menghapus appointment'),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (appt: any) => {
    setEditingId(appt.id);
    setForm({
      title: appt.title,
      description: appt.description || '',
      location: appt.location || '',
      start_time: appt.start_time ? format(new Date(appt.start_time), "yyyy-MM-dd'T'HH:mm") : '',
      end_time: appt.end_time ? format(new Date(appt.end_time), "yyyy-MM-dd'T'HH:mm") : '',
      contact_id: appt.contact_id || '',
      assigned_to_id: appt.assigned_to_id || '',
      notes: appt.notes || '',
      status: appt.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      title: form.title,
      description: form.description || undefined,
      location: form.location || undefined,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      contact_id: form.contact_id || undefined,
      assigned_to_id: form.assigned_to_id || undefined,
      notes: form.notes || undefined,
    };

    if (editingId) {
      body.status = form.status;
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const appointments = data?.data || [];
  const meta = data?.meta;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredAppointments = search
    ? appointments.filter((a: any) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.location?.toLowerCase().includes(search.toLowerCase())
      )
    : appointments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Appointment
          </h1>
          <p className="text-sm text-muted-foreground">Kelola jadwal pertemuan dan konsultasi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { downloadCsv('/export/appointments', 'appointments.csv').then(() => toast.success('Export berhasil')).catch(() => toast.error('Gagal export')); }}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Buat Appointment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari judul, kontak, lokasi..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="SCHEDULED">Terjadwal</SelectItem>
            <SelectItem value="CONFIRMED">Dikonfirmasi</SelectItem>
            <SelectItem value="COMPLETED">Selesai</SelectItem>
            <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
            <SelectItem value="NO_SHOW">Tidak Hadir</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada appointment</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead className="hidden sm:table-cell">Kontak</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead className="hidden md:table-cell">Lokasi</TableHead>
                <TableHead className="hidden md:table-cell">PIC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"><span className="sr-only">Aksi</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appt: any) => (
                <TableRow key={appt.id}>
                  <TableCell className="font-medium">{appt.title}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {appt.contact?.name || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(appt.start_time), 'dd MMM yyyy HH:mm')}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        s/d {format(new Date(appt.end_time), 'HH:mm')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {appt.location ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{appt.location}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {appt.assigned_to ? (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {appt.assigned_to.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_COLORS[appt.status] || ''}>
                      {STATUS_LABELS[appt.status] || appt.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(appt)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(appt.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {meta.page} dari {meta.total_pages} ({meta.total} data)
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= meta.total_pages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Appointment' : 'Buat Appointment Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Judul *</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mulai *</Label>
                <Input type="datetime-local" value={form.start_time} onChange={(e) => setForm(f => ({ ...f, start_time: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Selesai *</Label>
                <Input type="datetime-local" value={form.end_time} onChange={(e) => setForm(f => ({ ...f, end_time: e.target.value }))} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Alamat atau link meeting" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kontak</Label>
                <Select value={form.contact_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, contact_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kontak" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">- Tanpa kontak -</SelectItem>
                    {(contacts || []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PIC</Label>
                <Select value={form.assigned_to_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, assigned_to_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih PIC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">- Belum ditentukan -</SelectItem>
                    {(teamMembers || []).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingId && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Terjadwal</SelectItem>
                    <SelectItem value="CONFIRMED">Dikonfirmasi</SelectItem>
                    <SelectItem value="COMPLETED">Selesai</SelectItem>
                    <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                    <SelectItem value="NO_SHOW">Tidak Hadir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? 'Simpan' : 'Buat'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
