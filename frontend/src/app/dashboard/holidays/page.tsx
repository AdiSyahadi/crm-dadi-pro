'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', date: '', is_recurring: false });

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const { data } = await api.get(`/holidays?year=${year}`);
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      if (editingId) {
        await api.patch(`/holidays/${editingId}`, payload);
      } else {
        await api.post('/holidays', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ name: '', date: '', is_recurring: false });
      toast.success(editingId ? 'Hari libur berhasil diupdate' : 'Hari libur berhasil ditambahkan');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message || 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/holidays/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Hari libur berhasil dihapus');
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', date: '', is_recurring: false });
    setDialogOpen(true);
  };

  const openEdit = (h: any) => {
    setEditingId(h.id);
    setForm({ name: h.name, date: h.date.split('T')[0], is_recurring: h.is_recurring });
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Kalender Hari Libur
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola hari libur untuk organisasi Anda</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Hari Libur
        </Button>
      </div>

      {/* Year navigation */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => setYear(y => y - 1)}>&lt;</Button>
        <span className="font-semibold text-lg">{year}</span>
        <Button variant="outline" size="sm" onClick={() => setYear(y => y + 1)}>&gt;</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daftar Hari Libur — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada hari libur untuk tahun {year}</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(h.date), 'MMM', { locale: localeId })}
                      </div>
                      <div className="text-xl font-bold">
                        {format(new Date(h.date), 'dd')}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.date), 'EEEE, d MMMM yyyy', { locale: localeId })}
                      </p>
                    </div>
                    {h.is_recurring && (
                      <Badge variant="secondary" className="text-[10px]">Berulang</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(h)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(h.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Hari Libur' : 'Tambah Hari Libur'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Contoh: Hari Kemerdekaan" />
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm(f => ({ ...f, is_recurring: v }))} />
              <Label>Berulang setiap tahun</Label>
            </div>
            <Button className="w-full" disabled={!form.name || !form.date || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
