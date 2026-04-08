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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Zap, Loader2, Trash2, Edit, Search } from 'lucide-react';
import { toast } from 'sonner';

interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export default function QuickRepliesPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ shortcut: '', title: '', content: '', category: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['quick-replies'],
    queryFn: async () => {
      const { data } = await api.get('/quick-replies');
      return data.data as QuickReply[];
    },
  });

  const quickReplies = data || [];
  const filtered = search
    ? quickReplies.filter(
        (qr) =>
          qr.shortcut.toLowerCase().includes(search.toLowerCase()) ||
          qr.title.toLowerCase().includes(search.toLowerCase()) ||
          qr.content.toLowerCase().includes(search.toLowerCase())
      )
    : quickReplies;

  const saveMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      if (editId) {
        await api.patch(`/quick-replies/${editId}`, input);
      } else {
        await api.post('/quick-replies', input);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      closeDialog();
      toast.success(editId ? 'Quick reply diperbarui' : 'Quick reply berhasil dibuat');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/quick-replies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Quick reply dihapus');
    },
  });

  function openCreate() {
    setEditId(null);
    setForm({ shortcut: '', title: '', content: '', category: '' });
    setDialogOpen(true);
  }

  function openEdit(qr: QuickReply) {
    setEditId(qr.id);
    setForm({ shortcut: qr.shortcut, title: qr.title, content: qr.content, category: qr.category || '' });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm({ shortcut: '', title: '', content: '', category: '' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quick Replies</h1>
          <p className="text-sm text-muted-foreground">
            Balasan cepat yang bisa diakses dengan mengetik <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/shortcut</kbd> di chat
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Quick Reply
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari quick reply..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? 'Tidak ada quick reply yang cocok' : 'Belum ada quick reply. Buat yang pertama!'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((qr) => (
            <Card key={qr.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-amber-600">/{qr.shortcut}</span>
                      <span className="text-sm font-medium">{qr.title}</span>
                      {qr.category && <Badge variant="outline" className="text-[10px]">{qr.category}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{qr.usage_count}x dipakai</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{qr.content}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(qr)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        openConfirm({
                          title: 'Hapus Quick Reply',
                          description: `Yakin hapus "/${qr.shortcut}"?`,
                          onConfirm: () => deleteMutation.mutate(qr.id),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Quick Reply' : 'Tambah Quick Reply'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shortcut</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/</span>
                  <Input
                    className="pl-7"
                    placeholder="salam"
                    value={form.shortcut}
                    onChange={(e) => setForm({ ...form, shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Kategori (opsional)</Label>
                <Input
                  placeholder="Umum"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                placeholder="Salam pembuka"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Isi Pesan</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y"
                placeholder="Halo {{nama}}, terima kasih sudah menghubungi kami..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Gunakan {'{{nama}}'} untuk nama kontak, {'{{phone}}'} untuk nomor telepon
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? 'Simpan' : 'Buat'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
