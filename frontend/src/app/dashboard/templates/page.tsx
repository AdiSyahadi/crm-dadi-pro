'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { WATextarea } from '@/components/ui/wa-textarea';
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
import { Plus, FileText, Loader2, Trash2, ToggleLeft, ToggleRight, Edit, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn, downloadCsv } from '@/lib/utils';

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', content: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at:desc');

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get('/templates?limit=50');
      return data;
    },
  });

  const templates = data?.data || [];
  const categories = Array.from(new Set(templates.map((t: any) => t.category).filter(Boolean))) as string[];
  const filteredTemplates = templates.filter((t: any) => {
    if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase()) && !t.content.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    return true;
  }).sort((a: any, b: any) => {
    const [field, order] = sortField.split(':');
    const dir = order === 'asc' ? 1 : -1;
    if (field === 'name') return dir * a.name.localeCompare(b.name);
    if (field === 'created_at') return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return 0;
  });

  const createMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      await api.post('/templates', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDialogOpen(false);
      setForm({ name: '', category: '', content: '' });
      toast.success('Template berhasil dibuat');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: typeof form }) => {
      await api.patch(`/templates/${id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ name: '', category: '', content: '' });
      toast.success('Template berhasil diperbarui');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ name: '', category: '', content: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (tpl: any) => {
    setEditingId(tpl.id);
    setForm({ name: tpl.name, category: tpl.category || '', content: tpl.content });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/templates/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Status template diperbarui');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template dihapus');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Template Pesan</h1>
          <p className="text-sm text-muted-foreground">Kelola template pesan untuk broadcast dan quick reply</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { downloadCsv('/export/templates', 'template.csv').then(() => toast.success('Export berhasil')).catch(() => toast.error('Gagal export')); }}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm({ name: '', category: '', content: '' }); } }}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Template
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Template' : 'Buat Template Baru'}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nama Template</Label>
                <Input
                  placeholder="Welcome Message"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  placeholder="greeting, promo, follow-up"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Isi Pesan</Label>
                <WATextarea
                  placeholder="Halo {{name}}, terima kasih telah menghubungi kami..."
                  rows={5}
                  value={form.content}
                  onChange={(v) => setForm({ ...form, content: v })}
                  required
                />
                <p className="text-xs text-muted-foreground">Gunakan {"{{variable}}"} untuk variabel dinamis</p>
              </div>
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? 'Simpan Perubahan' : 'Simpan Template'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Belum ada template</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari template..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          {categories.length > 0 && (
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at:desc">Terbaru</SelectItem>
              <SelectItem value="created_at:asc">Terlama</SelectItem>
              <SelectItem value="name:asc">Nama A-Z</SelectItem>
              <SelectItem value="name:desc">Nama Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((tpl: any) => (
            <Card key={tpl.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{tpl.name}</h3>
                    {tpl.category && (
                      <Badge variant="outline" className="text-[10px] mt-1">{tpl.category}</Badge>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] shrink-0',
                      tpl.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {tpl.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 mt-3 mb-3">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{tpl.content}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    Digunakan {tpl.usage_count || 0}x
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(tpl)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleMutation.mutate(tpl.id)}
                    >
                      {tpl.is_active ? (
                        <ToggleRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => openConfirm({ title: 'Hapus template ini?', description: 'Template akan dihapus permanen.', onConfirm: () => deleteMutation.mutate(tpl.id) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
