'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WATextarea } from '@/components/ui/wa-textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  Search,
  Paperclip,
  X,
  FileText,
  Film,
  Music,
  CalendarClock,
  Users,
  History,
  Edit,
  CheckCircle,
  XCircle,
  Tag,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_LABELS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

type RepeatType = 'daily' | 'weekdays' | 'custom_days' | 'monthly';

// Build cron from user-friendly inputs
function buildCron(hour: number, minute: number, repeatType: RepeatType, activeDays: number[], monthDate: number): string {
  const m = String(minute);
  const h = String(hour);
  switch (repeatType) {
    case 'daily': return `${m} ${h} * * *`;
    case 'weekdays': return `${m} ${h} * * 1-5`;
    case 'custom_days': {
      const days = activeDays.length > 0 ? activeDays.sort().join(',') : '*';
      return `${m} ${h} * * ${days}`;
    }
    case 'monthly': return `${m} ${h} ${monthDate} * *`;
    default: return `${m} ${h} * * *`;
  }
}

// Parse cron back to user-friendly inputs
function parseCron(cron: string): { hour: number; minute: number; repeatType: RepeatType; activeDays: number[]; monthDate: number } {
  const parts = cron.split(' ');
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 0;
  const dayOfMonth = parts[2];
  const dayOfWeek = parts[4];

  if (dayOfMonth !== '*') {
    return { hour, minute, repeatType: 'monthly', activeDays: [], monthDate: parseInt(dayOfMonth) || 1 };
  }
  if (dayOfWeek === '*') {
    return { hour, minute, repeatType: 'daily', activeDays: [], monthDate: 1 };
  }
  if (dayOfWeek === '1-5') {
    return { hour, minute, repeatType: 'weekdays', activeDays: [], monthDate: 1 };
  }
  const days = dayOfWeek.split(',').map(Number).filter((n) => !isNaN(n));
  return { hour, minute, repeatType: 'custom_days', activeDays: days, monthDate: 1 };
}

// Human-readable schedule description
function cronToHuman(cron: string): string {
  const { hour, minute, repeatType, activeDays, monthDate } = parseCron(cron);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  switch (repeatType) {
    case 'daily': return `Setiap hari jam ${time}`;
    case 'weekdays': return `Senin-Jumat jam ${time}`;
    case 'custom_days': {
      const dayNames = activeDays.map((d) => DAY_LABELS[d]).join(', ');
      return `${dayNames} jam ${time}`;
    }
    case 'monthly': return `Tanggal ${monthDate} setiap bulan jam ${time}`;
    default: return `Jam ${time}`;
  }
}

// Generate hour options (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
// Generate minute options (0, 5, 10, ..., 55)
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);
// Generate month date options (1-31)
const DATE_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

interface ScheduledMessage {
  id: string;
  name: string;
  message_content: string;
  media_url: string | null;
  media_type: string | null;
  cron_expression: string;
  timezone: string;
  skip_days: number[] | null;
  recipient_tag_ids: string[] | null;
  delay_min_seconds: number;
  delay_max_seconds: number;
  is_active: boolean;
  total_sent: number;
  total_failed: number;
  last_executed_at: string | null;
  next_execution_at: string | null;
  created_at: string;
  instance: { id: string; name: string; phone_number: string | null } | null;
  created_by: { id: string; name: string } | null;
  _count: { recipients: number; logs: number };
  recipients?: any[];
  logs?: any[];
}

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

export default function ScheduledMessagesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [addRecipientDialogOpen, setAddRecipientDialogOpen] = useState(false);
  const [addRecipientSearch, setAddRecipientSearch] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formInstanceId, setFormInstanceId] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formHour, setFormHour] = useState(4);
  const [formMinute, setFormMinute] = useState(30);
  const [formRepeatType, setFormRepeatType] = useState<RepeatType>('daily');
  const [formActiveDays, setFormActiveDays] = useState<number[]>([]);
  const [formMonthDate, setFormMonthDate] = useState(1);
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [formSelectedContacts, setFormSelectedContacts] = useState<string[]>([]);
  const [formMediaFile, setFormMediaFile] = useState<File | null>(null);
  const [formMediaPreview, setFormMediaPreview] = useState<string | null>(null);
  const [formMediaUploading, setFormMediaUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMediaTypeFromFile = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const clearFormMedia = () => {
    setFormMediaFile(null);
    if (formMediaPreview) URL.revokeObjectURL(formMediaPreview);
    setFormMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormMediaFile(file);
    if (file.type.startsWith('image/')) {
      setFormMediaPreview(URL.createObjectURL(file));
    } else {
      setFormMediaPreview(null);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormInstanceId('');
    setFormMessage('');
    setFormHour(4);
    setFormMinute(30);
    setFormRepeatType('daily');
    setFormActiveDays([]);
    setFormMonthDate(1);
    setFormTagIds([]);
    setFormSelectedContacts([]);
    clearFormMedia();
    setEditingId(null);
  };

  // Queries
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: async () => {
      const { data } = await api.get('/scheduled-messages');
      return data.data as ScheduledMessage[];
    },
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: async () => {
      const { data } = await api.get('/instances');
      return data.data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-all'],
    queryFn: async () => {
      const { data } = await api.get('/contacts?limit=100');
      return data.data || [];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get('/contacts/tags');
      return (data.data || []) as TagItem[];
    },
  });

  // Fetch active templates for auto-fill
  const { data: activeTemplates = [] } = useQuery({
    queryKey: ['templates-active'],
    queryFn: async () => {
      const { data } = await api.get('/templates?is_active=true&limit=50');
      return (data.data || []) as { id: string; name: string; category: string | null; content: string }[];
    },
    staleTime: 60_000,
  });

  const { data: detailData } = useQuery({
    queryKey: ['scheduled-messages', detailId],
    queryFn: async () => {
      if (!detailId) return null;
      const { data } = await api.get(`/scheduled-messages/${detailId}`);
      return data.data as ScheduledMessage;
    },
    enabled: !!detailId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/scheduled-messages', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Jadwal pesan berhasil dibuat');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Gagal membuat jadwal'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data } = await api.patch(`/scheduled-messages/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Jadwal pesan berhasil diperbarui');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal memperbarui jadwal'),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/scheduled-messages/${id}/toggle`);
      return data;
    },
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success(resp.message || 'Status jadwal diubah');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal mengubah status'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/scheduled-messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Jadwal pesan dihapus');
      if (detailId) setDetailId(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghapus'),
  });

  const addRecipientsMutation = useMutation({
    mutationFn: async ({ id, contactIds }: { id: string; contactIds: string[] }) => {
      await api.post(`/scheduled-messages/${id}/recipients`, { contact_ids: contactIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', detailId] });
      toast.success('Penerima ditambahkan');
      setAddRecipientDialogOpen(false);
      setAddRecipientSearch('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menambah penerima'),
  });

  const removeRecipientsMutation = useMutation({
    mutationFn: async ({ id, contactIds }: { id: string; contactIds: string[] }) => {
      await api.delete(`/scheduled-messages/${id}/recipients`, { data: { contact_ids: contactIds } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', detailId] });
      toast.success('Penerima dihapus');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghapus penerima'),
  });

  const handleSubmit = async () => {
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    if (formMediaFile) {
      setFormMediaUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', formMediaFile);
        const { data: uploadResp } = await api.post('/media/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrl = uploadResp.data?.url || uploadResp.data?.media_url;
        mediaType = getMediaTypeFromFile(formMediaFile);
      } catch {
        toast.error('Gagal upload media');
        setFormMediaUploading(false);
        return;
      }
      setFormMediaUploading(false);
    }

    const cronExpression = buildCron(formHour, formMinute, formRepeatType, formActiveDays, formMonthDate);

    const payload: any = {
      name: formName,
      instance_id: formInstanceId,
      message_content: formMessage,
      cron_expression: cronExpression,
      recipient_tag_ids: formTagIds.length > 0 ? formTagIds : undefined,
      recipient_contact_ids: formSelectedContacts.length > 0 ? formSelectedContacts : undefined,
    };

    if (mediaUrl) {
      payload.media_url = mediaUrl;
      payload.media_type = mediaType;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEditDialog = (s: ScheduledMessage) => {
    setEditingId(s.id);
    setFormName(s.name);
    setFormInstanceId(s.instance?.id || '');
    setFormMessage(s.message_content);
    const parsed = parseCron(s.cron_expression);
    setFormHour(parsed.hour);
    setFormMinute(parsed.minute);
    setFormRepeatType(parsed.repeatType);
    setFormActiveDays(parsed.activeDays);
    setFormMonthDate(parsed.monthDate);
    setFormTagIds((s.recipient_tag_ids as string[]) || []);
    setFormSelectedContacts([]);
    clearFormMedia();
    setDialogOpen(true);
  };

  const toggleActiveDay = (day: number) => {
    setFormActiveDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const filteredContacts = contacts.filter(
    (c: any) =>
      (c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.phone_number?.includes(contactSearch)) &&
      !formSelectedContacts.includes(c.id)
  );

  const addRecipientContacts = contacts.filter(
    (c: any) =>
      (c.name?.toLowerCase().includes(addRecipientSearch.toLowerCase()) ||
        c.phone_number?.includes(addRecipientSearch)) &&
      !detailData?.recipients?.some((r: any) => r.contact_id === c.id)
  );


  return (
    <FeatureGate feature="scheduledMessages">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Jadwal Pesan</h1>
          <p className="text-sm text-muted-foreground">Kirim pesan otomatis berulang ke kontak WhatsApp</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Buat Jadwal Baru
        </Button>
      </div>

      {/* Info template variables */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Template variabel yang bisa dipakai di pesan:{' '}
              <code className="bg-muted px-1 rounded">{'{nama}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{phone}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{tanggal}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{hari}'}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Schedule list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jadwal</TableHead>
                <TableHead>Penerima</TableHead>
                <TableHead>Statistik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada jadwal pesan
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(s.id)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{s.message_content}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p className="font-medium">{cronToHuman(s.cron_expression)}</p>
                        {s.skip_days && (s.skip_days as number[]).length > 0 && (
                          <p className="text-muted-foreground">
                            Skip: {(s.skip_days as number[]).map((d) => DAY_LABELS[d]).join(', ')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Users className="h-3 w-3" />
                        <span>{s._count.recipients} kontak</span>
                        {s.recipient_tag_ids && (s.recipient_tag_ids as string[]).length > 0 && (
                          <Badge variant="outline" className="text-[10px] ml-1">
                            <Tag className="h-2.5 w-2.5 mr-0.5" />
                            +tag
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="text-emerald-600">{s.total_sent} terkirim</span>
                        {s.total_failed > 0 && <span className="text-red-600 ml-2">{s.total_failed} gagal</span>}
                        {s.last_executed_at && (
                          <p className="text-muted-foreground">
                            Terakhir: {format(new Date(s.last_executed_at), 'dd/MM HH:mm')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={() => toggleMutation.mutate(s.id)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(s)} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600"
                          onClick={() => {
                            if (confirm('Hapus jadwal ini?')) deleteMutation.mutate(s.id);
                          }}
                          title="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Jadwal Pesan' : 'Buat Jadwal Pesan Baru'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label>Nama Jadwal</Label>
              <Input placeholder="Contoh: Reminder Sedekah Subuh" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>

            {/* Instance */}
            <div>
              <Label>Instance WhatsApp</Label>
              <Select value={formInstanceId} onValueChange={setFormInstanceId}>
                <SelectTrigger><SelectValue placeholder="Pilih instance" /></SelectTrigger>
                <SelectContent>
                  {instances.map((inst: any) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name} {inst.phone_number ? `(${inst.phone_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template auto-fill */}
            {activeTemplates.length > 0 && (
              <div>
                <Label>Gunakan Template (opsional)</Label>
                <Select value="__none__" onValueChange={(v) => {
                  if (v !== '__none__') {
                    const tpl = activeTemplates.find((t) => t.id === v);
                    if (tpl) setFormMessage(tpl.content);
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Pilih template..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa Template</SelectItem>
                    {activeTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}{tpl.category ? ` (${tpl.category})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Template akan mengisi pesan otomatis. Anda tetap bisa mengedit.</p>
              </div>
            )}

            {/* Message */}
            <div>
              <Label>Isi Pesan</Label>
              <WATextarea
                placeholder="Assalamualaikum {nama}, jangan lupa sedekah subuh hari {hari} 🤲"
                value={formMessage}
                onChange={(v) => setFormMessage(v)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variabel: {'{nama}'} {'{phone}'} {'{tanggal}'} {'{hari}'}
              </p>
            </div>

            {/* Media */}
            <div>
              <Label>Media (opsional)</Label>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,application/pdf" onChange={handleFileSelect} />
              {formMediaFile ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg mt-1">
                  {formMediaPreview ? (
                    <img src={formMediaPreview} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted-foreground/10 flex items-center justify-center">
                      {formMediaFile.type.startsWith('video/') ? <Film className="h-5 w-5" /> : formMediaFile.type.startsWith('audio/') ? <Music className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                  )}
                  <span className="text-sm truncate flex-1">{formMediaFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearFormMedia}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" /> Pilih File
                </Button>
              )}
            </div>

            <Separator />

            {/* Schedule - Time */}
            <div>
              <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Jam Pengiriman</Label>
              <div className="flex items-center gap-2 mt-1">
                <Select value={String(formHour)} onValueChange={(v) => setFormHour(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-lg font-bold">:</span>
                <Select value={String(formMinute)} onValueChange={(v) => setFormMinute(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>{String(m).padStart(2, '0')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">WIB</span>
              </div>
            </div>

            {/* Schedule - Repeat type */}
            <div>
              <Label>Pengulangan</Label>
              <Select value={formRepeatType} onValueChange={(v) => setFormRepeatType(v as RepeatType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Setiap hari</SelectItem>
                  <SelectItem value="weekdays">Senin - Jumat (hari kerja)</SelectItem>
                  <SelectItem value="custom_days">Pilih hari tertentu</SelectItem>
                  <SelectItem value="monthly">Setiap bulan (pilih tanggal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom days picker */}
            {formRepeatType === 'custom_days' && (
              <div>
                <Label>Pilih Hari</Label>
                <p className="text-xs text-muted-foreground mb-2">Pesan akan dikirim di hari yang dipilih</p>
                <div className="flex gap-2 flex-wrap">
                  {DAY_LABELS.map((label, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant={formActiveDays.includes(idx) ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-12"
                      onClick={() => toggleActiveDay(idx)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly date picker */}
            {formRepeatType === 'monthly' && (
              <div>
                <Label>Tanggal Pengiriman</Label>
                <Select value={String(formMonthDate)} onValueChange={(v) => setFormMonthDate(Number(v))}>
                  <SelectTrigger className="w-32 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATE_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>Tanggal {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">Jadwal:</p>
              <p className="font-medium">{cronToHuman(buildCron(formHour, formMinute, formRepeatType, formActiveDays, formMonthDate))}</p>
            </div>

            <Separator />

            {/* Tag-based recipients */}
            {tags.length > 0 && (
              <div>
                <Label>Penerima Otomatis by Tag</Label>
                <p className="text-xs text-muted-foreground mb-2">Semua kontak dengan tag ini otomatis menerima pesan</p>
                <div className="flex gap-2 flex-wrap">
                  {tags.map((tag: TagItem) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant={formTagIds.includes(tag.id) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setFormTagIds((prev) =>
                          prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id]
                        )
                      }
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual recipients (only for create) */}
            {!editingId && (
              <div>
                <Label>Penerima Manual</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari kontak..."
                    className="pl-8"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                </div>
                {formSelectedContacts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formSelectedContacts.map((cid) => {
                      const c = contacts.find((ct: any) => ct.id === cid);
                      return (
                        <Badge key={cid} variant="secondary" className="gap-1 text-xs">
                          {c?.name || c?.phone_number || cid}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setFormSelectedContacts((prev) => prev.filter((id) => id !== cid))}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <ScrollArea className="max-h-40 mt-2">
                  {filteredContacts.slice(0, 50).map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                      onClick={() => setFormSelectedContacts((prev) => [...prev, c.id])}
                    >
                      <div>
                        <p className="text-sm">{c.name || c.phone_number}</p>
                        {c.name && <p className="text-xs text-muted-foreground">{c.phone_number}</p>}
                      </div>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!formName || !formInstanceId || !formMessage || createMutation.isPending || updateMutation.isPending || formMediaUploading}
            >
              {(createMutation.isPending || updateMutation.isPending || formMediaUploading) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingId ? 'Simpan Perubahan' : 'Buat Jadwal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              {detailData?.name || 'Detail Jadwal'}
            </DialogTitle>
          </DialogHeader>

          {detailData && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Jadwal</p>
                  <p className="font-medium">{cronToHuman(detailData.cron_expression)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={detailData.is_active ? 'default' : 'secondary'}>
                    {detailData.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Instance</p>
                  <p className="font-medium">{detailData.instance?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Terakhir Kirim</p>
                  <p className="font-medium">
                    {detailData.last_executed_at ? format(new Date(detailData.last_executed_at), 'dd/MM/yyyy HH:mm') : 'Belum pernah'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Pesan</p>
                  <p className="font-medium whitespace-pre-wrap bg-muted p-2 rounded text-xs mt-1">{detailData.message_content}</p>
                </div>
                {detailData.skip_days && (detailData.skip_days as number[]).length > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Skip Hari</p>
                    <div className="flex gap-1 mt-1">
                      {(detailData.skip_days as number[]).map((d) => (
                        <Badge key={d} variant="outline" className="text-xs">{DAY_LABELS[d]}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    <Users className="h-4 w-4" /> Penerima Manual ({detailData.recipients?.length || 0})
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setAddRecipientDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                  </Button>
                </div>
                <ScrollArea className="max-h-40">
                  {detailData.recipients?.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded">
                      <div>
                        <p className="text-sm">{r.contact?.name || r.phone_number}</p>
                        <p className="text-xs text-muted-foreground">{r.phone_number}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500"
                        onClick={() => {
                          if (detailId) removeRecipientsMutation.mutate({ id: detailId, contactIds: [r.contact_id] });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {(!detailData.recipients || detailData.recipients.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada penerima manual</p>
                  )}
                </ScrollArea>
              </div>

              <Separator />

              {/* Logs */}
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-1 mb-2">
                  <History className="h-4 w-4" /> Riwayat Pengiriman
                </h3>
                <ScrollArea className="max-h-48">
                  {detailData.logs && detailData.logs.length > 0 ? (
                    detailData.logs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between px-2 py-1.5 border-b last:border-0">
                        <div className="text-xs">
                          <p className="font-medium">{format(new Date(log.executed_at), 'dd/MM/yyyy HH:mm')}</p>
                          {log.skipped_reason && <p className="text-amber-600">{log.skipped_reason}</p>}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5 text-emerald-600">
                            <CheckCircle className="h-3 w-3" /> {log.sent_count}
                          </span>
                          {log.failed_count > 0 && (
                            <span className="flex items-center gap-0.5 text-red-600">
                              <XCircle className="h-3 w-3" /> {log.failed_count}
                            </span>
                          )}
                          <span className="text-muted-foreground">/ {log.total_targets}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada riwayat</p>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Recipient Dialog */}
      <Dialog open={addRecipientDialogOpen} onOpenChange={setAddRecipientDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Penerima</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kontak..."
              className="pl-8"
              value={addRecipientSearch}
              onChange={(e) => setAddRecipientSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="max-h-60">
            {addRecipientContacts.slice(0, 50).map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                onClick={() => {
                  if (detailId) addRecipientsMutation.mutate({ id: detailId, contactIds: [c.id] });
                }}
              >
                <div>
                  <p className="text-sm">{c.name || c.phone_number}</p>
                  {c.name && <p className="text-xs text-muted-foreground">{c.phone_number}</p>}
                </div>
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
    </FeatureGate>
  );
}
