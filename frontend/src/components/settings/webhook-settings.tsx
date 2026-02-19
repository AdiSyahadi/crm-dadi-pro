'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const WEBHOOK_EVENTS = [
  { key: 'message.received', label: 'Pesan Masuk', group: 'Pesan' },
  { key: 'message.sent', label: 'Pesan Terkirim', group: 'Pesan' },
  { key: 'message.delivered', label: 'Pesan Diterima', group: 'Pesan' },
  { key: 'message.read', label: 'Pesan Dibaca', group: 'Pesan' },
  { key: 'contact.created', label: 'Kontak Baru', group: 'Kontak' },
  { key: 'contact.updated', label: 'Kontak Diperbarui', group: 'Kontak' },
  { key: 'deal.created', label: 'Deal Baru', group: 'Deal' },
  { key: 'deal.updated', label: 'Deal Diperbarui', group: 'Deal' },
  { key: 'deal.stage_changed', label: 'Stage Berubah', group: 'Deal' },
  { key: 'deal.won', label: 'Deal Won', group: 'Deal' },
  { key: 'deal.lost', label: 'Deal Lost', group: 'Deal' },
  { key: 'conversation.assigned', label: 'Chat Ditugaskan', group: 'Chat' },
  { key: 'conversation.resolved', label: 'Chat Selesai', group: 'Chat' },
  { key: 'conversation.reopened', label: 'Chat Dibuka Ulang', group: 'Chat' },
] as const;

const EVENT_GROUPS = ['Pesan', 'Kontak', 'Deal', 'Chat'] as const;

interface WebhookConfig {
  id: string;
  name: string;
  webhook_url: string;
  webhook_secret: string | null;
  events: string[] | null;
  wa_instance_id: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

const emptyForm = {
  name: '',
  webhook_url: '',
  webhook_secret: '',
  events: WEBHOOK_EVENTS.map((e) => e.key) as string[],
};

export function WebhookSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showSecret, setShowSecret] = useState(false);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhook-configs'],
    queryFn: async () => {
      const { data } = await api.get('/webhook-configs');
      return data.data as WebhookConfig[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      const payload = {
        ...input,
        webhook_secret: input.webhook_secret || undefined,
      };
      if (editingId) {
        await api.patch(`/webhook-configs/${editingId}`, payload);
      } else {
        await api.post('/webhook-configs', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success(editingId ? 'Webhook berhasil diperbarui' : 'Webhook berhasil ditambahkan');
      closeDialog();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan webhook');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await api.patch(`/webhook-configs/${id}`, { is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengubah status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhook-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success('Webhook berhasil dihapus');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menghapus webhook');
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/webhook-configs/${id}/test`);
      return data.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Test berhasil! Status: ${data.status}`);
      } else {
        toast.error(`Test gagal: ${data.statusText}`);
      }
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengirim test');
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowSecret(false);
    setDialogOpen(true);
  }

  function openEdit(wh: WebhookConfig) {
    setEditingId(wh.id);
    setForm({
      name: wh.name,
      webhook_url: wh.webhook_url,
      webhook_secret: wh.webhook_secret || '',
      events: (wh.events as string[]) || WEBHOOK_EVENTS.map((e) => e.key),
    });
    setShowSecret(false);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleEvent(eventKey: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventKey)
        ? prev.events.filter((e) => e !== eventKey)
        : [...prev.events, eventKey],
    }));
  }

  function toggleGroup(group: string) {
    const groupEvents = WEBHOOK_EVENTS.filter((e) => e.group === group).map((e) => e.key);
    const allSelected = groupEvents.every((e) => form.events.includes(e));
    setForm((prev) => ({
      ...prev,
      events: allSelected
        ? prev.events.filter((e) => !groupEvents.includes(e as any))
        : Array.from(new Set([...prev.events, ...groupEvents])),
    }));
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Webhook (n8n / Integrasi)
              </CardTitle>
              <CardDescription className="mt-1">
                Kirim event CRM ke URL eksternal seperti n8n, Zapier, atau sistem lainnya secara otomatis.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Belum ada webhook</p>
              <p className="text-xs mt-1">Tambahkan webhook untuk mengirim event CRM ke n8n atau sistem eksternal lainnya.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className={cn(
                    'rounded-lg border p-4 transition-colors',
                    wh.is_active ? 'bg-card' : 'bg-muted/30 opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold truncate">{wh.name}</p>
                        {wh.is_active ? (
                          <Badge variant="default" className="text-[10px] h-5">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] h-5">Nonaktif</Badge>
                        )}
                        {wh.failure_count > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {wh.failure_count} gagal
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[400px] block">
                          {wh.webhook_url}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(wh.webhook_url);
                            toast.success('URL disalin');
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {((wh.events as string[]) || []).slice(0, 5).map((ev) => (
                          <Badge key={ev} variant="outline" className="text-[10px] h-5 font-normal">
                            {WEBHOOK_EVENTS.find((e) => e.key === ev)?.label || ev}
                          </Badge>
                        ))}
                        {((wh.events as string[]) || []).length > 5 && (
                          <Badge variant="outline" className="text-[10px] h-5 font-normal">
                            +{((wh.events as string[]) || []).length - 5} lainnya
                          </Badge>
                        )}
                      </div>
                      {wh.last_triggered_at && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Terakhir dipanggil: {new Date(wh.last_triggered_at).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={wh.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: wh.id, is_active: checked })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => testMutation.mutate(wh.id)}
                        disabled={testMutation.isPending || !wh.is_active}
                        title="Test Webhook"
                      >
                        {testMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(wh)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Hapus webhook "${wh.name}"?`)) {
                            deleteMutation.mutate(wh.id);
                          }
                        }}
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Webhook' : 'Tambah Webhook Baru'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (form.events.length === 0) {
                toast.error('Pilih minimal 1 event');
                return;
              }
              createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nama Webhook</Label>
              <Input
                placeholder="n8n Production"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">Label untuk membedakan webhook Anda.</p>
            </div>

            <div className="space-y-2">
              <Label>URL Webhook</Label>
              <Input
                placeholder="https://your-n8n.com/webhook/abc123"
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                required
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                URL dari n8n Webhook node atau endpoint lainnya. CRM akan mengirim HTTP POST ke URL ini.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Secret Key <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Untuk verifikasi signature HMAC-SHA256"
                  value={form.webhook_secret}
                  onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Jika diisi, CRM akan mengirim header <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> berisi HMAC-SHA256.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Event yang Dikirim</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    const allKeys = WEBHOOK_EVENTS.map((e) => e.key);
                    setForm((prev) => ({
                      ...prev,
                      events: prev.events.length === allKeys.length ? [] : [...allKeys],
                    }));
                  }}
                >
                  {form.events.length === WEBHOOK_EVENTS.length ? 'Hapus Semua' : 'Pilih Semua'}
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                {EVENT_GROUPS.map((group) => {
                  const groupEvents = WEBHOOK_EVENTS.filter((e) => e.group === group);
                  const allChecked = groupEvents.every((e) => form.events.includes(e.key));
                  const someChecked = groupEvents.some((e) => form.events.includes(e.key));

                  return (
                    <div key={group}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={() => toggleGroup(group)}
                          className="h-3.5 w-3.5 rounded border-input accent-primary"
                        />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 ml-5">
                        {groupEvents.map((ev) => (
                          <label key={ev.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={form.events.includes(ev.key)}
                              onChange={() => toggleEvent(ev.key)}
                              className="h-3.5 w-3.5 rounded border-input accent-primary"
                            />
                            <span className="text-xs">{ev.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.events.length} dari {WEBHOOK_EVENTS.length} event dipilih
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? 'Simpan Perubahan' : 'Tambah Webhook'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
