'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TaskFormData {
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  due_date: string;
  reminder_at: string;
  assigned_to_id: string;
  contact_id: string;
  deal_id: string;
}

const INITIAL_FORM: TaskFormData = {
  title: '',
  description: '',
  type: 'OTHER',
  priority: 'MEDIUM',
  status: 'TODO',
  due_date: '',
  reminder_at: '',
  assigned_to_id: '',
  contact_id: '',
  deal_id: '',
};

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any | null;
  onSuccess?: () => void;
}

export function TaskDialog({ open, onOpenChange, task, onSuccess }: TaskDialogProps) {
  const [form, setForm] = useState<TaskFormData>(INITIAL_FORM);
  const isEdit = !!task;

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        type: task.type || 'OTHER',
        priority: task.priority || 'MEDIUM',
        status: task.status || 'TODO',
        due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
        reminder_at: task.reminder_at ? new Date(task.reminder_at).toISOString().slice(0, 16) : '',
        assigned_to_id: task.assigned_to?.id || '',
        contact_id: task.contact?.id || '',
        deal_id: task.deal?.id || '',
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [task, open]);

  const { data: members = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await api.get('/teams/members');
      return data.data as { id: string; name: string }[];
    },
    enabled: open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-for-task'],
    queryFn: async () => {
      const { data } = await api.get('/contacts?limit=200');
      return data.data as { id: string; name: string; phone_number: string }[];
    },
    enabled: open,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-task'],
    queryFn: async () => {
      const { data } = await api.get('/deals?limit=100');
      return data.data as { id: string; title: string; deal_number: string }[];
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      await api.post('/tasks', input);
    },
    onSuccess: () => {
      toast.success('Tugas berhasil dibuat');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal membuat tugas');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: any) => {
      await api.patch(`/tasks/${task.id}`, input);
    },
    onSuccess: () => {
      toast.success('Tugas berhasil diperbarui');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal memperbarui tugas');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      title: form.title,
      type: form.type,
      priority: form.priority,
    };

    if (form.description) payload.description = form.description;
    if (form.due_date) payload.due_date = new Date(form.due_date).toISOString();
    if (form.reminder_at) payload.reminder_at = new Date(form.reminder_at).toISOString();
    if (form.assigned_to_id) payload.assigned_to_id = form.assigned_to_id;
    if (form.contact_id) payload.contact_id = form.contact_id;
    if (form.deal_id) payload.deal_id = form.deal_id;

    if (isEdit) {
      payload.status = form.status;
      // Send null for cleared optional fields
      if (!form.due_date && task.due_date) payload.due_date = null;
      if (!form.reminder_at && task.reminder_at) payload.reminder_at = null;
      if (!form.assigned_to_id && task.assigned_to) payload.assigned_to_id = null;
      if (!form.contact_id && task.contact) payload.contact_id = null;
      if (!form.deal_id && task.deal) payload.deal_id = null;
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Tugas' : 'Buat Tugas Baru'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Judul *</Label>
            <Input
              placeholder="Contoh: Follow up klien ABC"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea
              placeholder="Detail tugas..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="CALL">Telepon</SelectItem>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="OTHER">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioritas</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Rendah</SelectItem>
                  <SelectItem value="MEDIUM">Sedang</SelectItem>
                  <SelectItem value="HIGH">Tinggi</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status (only for edit) */}
          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">Sedang Dikerjakan</SelectItem>
                  <SelectItem value="DONE">Selesai</SelectItem>
                  <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Due date + Reminder row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tenggat</Label>
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pengingat</Label>
              <Input
                type="datetime-local"
                value={form.reminder_at}
                onChange={(e) => setForm({ ...form, reminder_at: e.target.value })}
              />
            </div>
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label>Ditugaskan Ke</Label>
            <Select value={form.assigned_to_id || '_none'} onValueChange={(v) => setForm({ ...form, assigned_to_id: v === '_none' ? '' : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih anggota tim..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Tidak ada</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <Label>Kontak (opsional)</Label>
            <Select value={form.contact_id || '_none'} onValueChange={(v) => setForm({ ...form, contact_id: v === '_none' ? '' : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kontak..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Tidak ada</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name || c.phone_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deal */}
          <div className="space-y-2">
            <Label>Deal (opsional)</Label>
            <Select value={form.deal_id || '_none'} onValueChange={(v) => setForm({ ...form, deal_id: v === '_none' ? '' : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih deal..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Tidak ada</SelectItem>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title} ({d.deal_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Simpan Perubahan' : 'Buat Tugas'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
