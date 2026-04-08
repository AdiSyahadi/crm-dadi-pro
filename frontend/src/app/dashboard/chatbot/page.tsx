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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bot, Plus, Trash2, Pencil, Copy, Zap, Power, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const TRIGGER_LABELS: Record<string, string> = {
  MESSAGE_RECEIVED: 'Semua Pesan',
  KEYWORD_MATCH: 'Kata Kunci',
  FIRST_MESSAGE: 'Pesan Pertama',
  CONTACT_CREATED: 'Kontak Baru',
  NO_REPLY_TIMEOUT: 'Timeout Tidak Balas',
  BUSINESS_HOURS: 'Jam Kerja',
};

const ACTION_LABELS: Record<string, string> = {
  SEND_REPLY: 'Kirim Balasan',
  ASSIGN_TEAM: 'Tugaskan ke Tim',
  ASSIGN_USER: 'Tugaskan ke User',
  ADD_TAG: 'Tambah Tag',
  SET_STAGE: 'Set Stage Kontak',
  SEND_NOTIFICATION: 'Kirim Notifikasi',
  WEBHOOK: 'Webhook',
};

interface FormState {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
  priority: number;
  is_active: boolean;
}

const defaultForm: FormState = {
  name: '',
  description: '',
  trigger_type: 'KEYWORD_MATCH',
  trigger_config: { keywords: [] },
  action_type: 'SEND_REPLY',
  action_config: { message: '' },
  priority: 0,
  is_active: true,
};

export default function ChatbotPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [keywordsInput, setKeywordsInput] = useState('');

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ['chatbot-flows'],
    queryFn: async () => { const { data } = await api.get('/chatbot'); return data.data; },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      if (editingId) {
        await api.patch(`/chatbot/${editingId}`, payload);
      } else {
        await api.post('/chatbot', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
      setKeywordsInput('');
      toast.success(editingId ? 'Flow berhasil diupdate' : 'Flow berhasil dibuat');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message || 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/chatbot/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] }); toast.success('Flow dihapus'); },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/chatbot/${id}/toggle`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] }); },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/chatbot/${id}/duplicate`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] }); toast.success('Flow diduplikasi'); },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setKeywordsInput('');
    setDialogOpen(true);
  };

  const openEdit = (f: any) => {
    setEditingId(f.id);
    const tc = f.trigger_config || {};
    const ac = f.action_config || {};
    setForm({
      name: f.name,
      description: f.description || '',
      trigger_type: f.trigger_type,
      trigger_config: tc,
      action_type: f.action_type,
      action_config: ac,
      priority: f.priority,
      is_active: f.is_active,
    });
    setKeywordsInput((tc.keywords || []).join(', '));
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = { ...form };
    if (payload.trigger_type === 'KEYWORD_MATCH') {
      payload.trigger_config = {
        keywords: keywordsInput.split(',').map(k => k.trim()).filter(Boolean),
      };
    }
    saveMutation.mutate(payload);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" /> Chatbot Flow Builder
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Atur automasi respon dan alur chatbot</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Buat Flow
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Memuat...</p>
      ) : flows.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Belum ada chatbot flow. Buat flow pertama Anda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flows.map((f: any) => (
            <Card key={f.id} className={!f.is_active ? 'opacity-60' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{f.name}</p>
                    {f.description && <p className="text-xs text-muted-foreground truncate">{f.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {TRIGGER_LABELS[f.trigger_type] || f.trigger_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {ACTION_LABELS[f.action_type] || f.action_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        <MessageSquare className="h-3 w-3 inline" /> {f.execution_count}x
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={f.is_active} onCheckedChange={() => toggleMutation.mutate(f.id)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMutation.mutate(f.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Flow' : 'Buat Flow Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Nama Flow</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Contoh: Greeting Pelanggan Baru" />
            </div>
            <div>
              <Label>Deskripsi (opsional)</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Deskripsi singkat..." />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={form.trigger_type} onValueChange={(v) => setForm(f => ({ ...f, trigger_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.trigger_type === 'KEYWORD_MATCH' && (
              <div>
                <Label>Kata Kunci (pisahkan dengan koma)</Label>
                <Input value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} placeholder="halo, info, promo, harga" />
              </div>
            )}
            <div>
              <Label>Action</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm(f => ({ ...f, action_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.action_type === 'SEND_REPLY' && (
              <div>
                <Label>Pesan Balasan</Label>
                <Textarea
                  value={form.action_config?.message || ''}
                  onChange={(e) => setForm(f => ({ ...f, action_config: { ...f.action_config, message: e.target.value } }))}
                  placeholder="Halo! Terima kasih telah menghubungi kami..."
                  rows={4}
                />
              </div>
            )}
            <div>
              <Label>Prioritas (semakin tinggi, dicek duluan)</Label>
              <Input type="number" value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
            </div>
            <Button className="w-full" disabled={!form.name || saveMutation.isPending} onClick={handleSave}>
              {saveMutation.isPending ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
