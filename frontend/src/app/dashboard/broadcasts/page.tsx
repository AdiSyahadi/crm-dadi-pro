'use client';

import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { FeatureGate } from '@/components/feature-gate';
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
import { Send, Plus, Play, Pause, XCircle, Trash2, Loader2, Radio, Search, Paperclip, X, FileText, Film, Music, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  SCHEDULED: { label: 'Terjadwal', color: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Mengirim', color: 'bg-amber-100 text-amber-700' },
  PAUSED: { label: 'Dijeda', color: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  FAILED: { label: 'Gagal', color: 'bg-red-100 text-red-700' },
};

export default function BroadcastsPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formInstanceId, setFormInstanceId] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [formSelectedContacts, setFormSelectedContacts] = useState<string[]>([]);
  const [formMediaFile, setFormMediaFile] = useState<File | null>(null);
  const [formMediaPreview, setFormMediaPreview] = useState<string | null>(null);
  const [formMediaUploading, setFormMediaUploading] = useState(false);
  const [formTemplateId, setFormTemplateId] = useState<string>('');
  const bcFileInputRef = useRef<HTMLInputElement>(null);

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
    if (bcFileInputRef.current) bcFileInputRef.current.value = '';
  };

  const handleBcFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = file.type.startsWith('video/') ? 64 * 1024 * 1024
      : file.type.startsWith('image/') || file.type.startsWith('audio/') ? 16 * 1024 * 1024
      : 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File terlalu besar. Maksimal ${Math.round(maxSize / 1024 / 1024)}MB.`);
      return;
    }
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
    setFormTagIds([]);
    setFormSelectedContacts([]);
    setSelectedContactsMap({});
    setContactSearch('');
    setDebouncedSearch('');
    setFormTemplateId('');
    clearFormMedia();
  };

  // Fetch instances for select dropdown
  const { data: instancesData } = useQuery({
    queryKey: ['instances'],
    queryFn: async () => {
      const { data } = await api.get('/instances');
      return data;
    },
  });
  const instances = instancesData?.data || [];

  // Debounce contact search for server-side filtering
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContactSearch = (value: string) => {
    setContactSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  // Fetch contacts with server-side search (max 200)
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-broadcast', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const { data } = await api.get(`/contacts?${params}`);
      return data;
    },
  });
  const searchedContacts = contactsData?.data || [];

  // Maintain a map of selected contacts info for display
  const [selectedContactsMap, setSelectedContactsMap] = useState<Record<string, { id: string; name: string; phone_number: string }>>({});

  // Merge searched contacts into map for display purposes
  const displayContacts = useMemo(() => {
    const map = new Map<string, any>();
    // Add selected contacts first (so they always show)
    for (const c of Object.values(selectedContactsMap)) {
      map.set(c.id, c);
    }
    // Add search results
    for (const c of searchedContacts) {
      map.set(c.id, c);
    }
    return Array.from(map.values());
  }, [searchedContacts, selectedContactsMap]);

  // Fetch tags for tag-based recipient selection
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get('/contacts/tags');
      return (data.data || []) as { id: string; name: string; color: string | null }[];
    },
  });
  const tags = tagsData || [];

  // Fetch active templates for auto-fill
  const { data: templatesData } = useQuery({
    queryKey: ['templates-active'],
    queryFn: async () => {
      const { data } = await api.get('/templates?is_active=true&limit=50');
      return (data.data || []) as { id: string; name: string; category: string | null; content: string }[];
    },
    staleTime: 60_000,
  });
  const activeTemplates = templatesData || [];

  const toggleContact = (contact: any) => {
    const id = contact.id;
    setFormSelectedContacts((prev) => {
      if (prev.includes(id)) {
        setSelectedContactsMap((m) => { const copy = { ...m }; delete copy[id]; return copy; });
        return prev.filter((c) => c !== id);
      } else {
        setSelectedContactsMap((m) => ({ ...m, [id]: { id: contact.id, name: contact.name, phone_number: contact.phone_number } }));
        return [...prev, id];
      }
    });
  };

  const selectAllFiltered = () => {
    const map: Record<string, any> = {};
    for (const c of searchedContacts) {
      map[c.id] = { id: c.id, name: c.name, phone_number: c.phone_number };
    }
    setSelectedContactsMap((m) => ({ ...m, ...map }));
    setFormSelectedContacts((prev) => {
      const set = new Set(prev);
      searchedContacts.forEach((c: any) => set.add(c.id));
      return Array.from(set);
    });
  };

  const deselectAll = () => {
    setFormSelectedContacts([]);
    setSelectedContactsMap({});
  };

  const { data, isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: async () => {
      const { data } = await api.get('/broadcasts?limit=50');
      return data;
    },
    refetchInterval: (query) => {
      const list = query.state.data?.data || [];
      const hasSending = list.some((b: any) => b.status === 'SENDING');
      return hasSending ? 5000 : false;
    },
  });

  const broadcasts = data?.data || [];

  // Create broadcast mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (formMediaFile) {
        setFormMediaUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', formMediaFile);
          mediaType = getMediaTypeFromFile(formMediaFile).toUpperCase();
          formData.append('type', mediaType.toLowerCase());
          const { data: uploadResp } = await api.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          mediaUrl = uploadResp.data?.url;
          if (!mediaUrl) throw new Error('Upload gagal: URL tidak ditemukan');
        } finally {
          setFormMediaUploading(false);
        }
      }

      await api.post('/broadcasts', {
        name: formName,
        instance_id: formInstanceId,
        message_content: formMessage,
        template_id: formTemplateId || undefined,
        recipient_contact_ids: formSelectedContacts.length > 0 ? formSelectedContacts : undefined,
        recipient_tag_ids: formTagIds.length > 0 ? formTagIds : undefined,
        ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast berhasil dibuat');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || err.message || 'Gagal membuat broadcast'),
  });


  const startMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/broadcasts/${id}/start`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dimulai');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal'),
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/broadcasts/${id}/pause`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dijeda');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/broadcasts/${id}/cancel`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dibatalkan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/broadcasts/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast dihapus');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghapus'),
  });

  return (
    <FeatureGate feature="broadcast">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Broadcast</h1>
          <p className="text-sm text-muted-foreground">Kirim pesan massal ke kontak WhatsApp</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Broadcast
        </Button>
      </div>

      {/* Create Broadcast Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Broadcast Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="bc-name">Nama Broadcast</Label>
              <Input id="bc-name" placeholder="Contoh: Promo Februari 2026" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Instance WhatsApp</Label>
              <Select value={formInstanceId} onValueChange={setFormInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih instance..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst: any) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name || inst.phone_number || inst.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template auto-fill */}
            {activeTemplates.length > 0 && (
              <div className="space-y-2">
                <Label>Gunakan Template (opsional)</Label>
                <Select value={formTemplateId || '__none__'} onValueChange={(v) => {
                  const id = v === '__none__' ? '' : v;
                  setFormTemplateId(id);
                  if (id) {
                    const tpl = activeTemplates.find((t) => t.id === id);
                    if (tpl) setFormMessage(tpl.content);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa Template</SelectItem>
                    {activeTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}{tpl.category ? ` (${tpl.category})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Template akan mengisi pesan otomatis. Anda tetap bisa mengedit sebelum kirim.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bc-message">Isi Pesan</Label>
              <WATextarea id="bc-message" placeholder="Tulis pesan broadcast..." rows={4} value={formMessage} onChange={(v) => setFormMessage(v)} />
              <p className="text-xs text-muted-foreground">{formMessage.length}/4096 karakter</p>
            </div>

            {/* Media Attachment */}
            <div className="space-y-2">
              <Label>Lampiran Media (opsional)</Label>
              <input
                ref={bcFileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/mpeg,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                onChange={handleBcFileSelect}
              />
              {formMediaFile ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  {formMediaPreview ? (
                    <img src={formMediaPreview} alt="" className="h-14 w-14 rounded object-cover" />
                  ) : formMediaFile.type.startsWith('video/') ? (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center"><Film className="h-6 w-6 text-muted-foreground" /></div>
                  ) : formMediaFile.type.startsWith('audio/') ? (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center"><Music className="h-6 w-6 text-muted-foreground" /></div>
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center"><FileText className="h-6 w-6 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{formMediaFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(formMediaFile.size / 1024).toFixed(0)} KB · {getMediaTypeFromFile(formMediaFile)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearFormMedia}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full" onClick={() => bcFileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" />
                  Pilih File (Gambar, Video, Audio, Dokumen)
                </Button>
              )}
              {formMediaFile && formMediaFile.type.startsWith('audio/') && (
                <p className="text-xs text-amber-600">Audio tidak mendukung caption. Isi pesan akan dikirim sebagai pesan terpisah.</p>
              )}
            </div>

            {/* Tag-based recipients */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Penerima Otomatis by Tag</Label>
                <p className="text-xs text-muted-foreground">Semua kontak dengan tag ini otomatis menerima broadcast</p>
                <div className="flex gap-2 flex-wrap">
                  {tags.map((tag) => (
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Penerima Manual ({formSelectedContacts.length} dipilih)</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                    Pilih Semua
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={deselectAll}>
                    Hapus Semua
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari kontak..." className="pl-8" value={contactSearch} onChange={(e) => handleContactSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[200px] rounded-md border p-2">
                {displayContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada kontak</p>
                ) : (
                  displayContacts.map((contact: any) => (
                    <label key={contact.id} className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                        checked={formSelectedContacts.includes(contact.id)}
                        onChange={() => toggleContact(contact)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{contact.name || 'Tanpa Nama'}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone_number}</p>
                      </div>
                    </label>
                  ))
                )}
              </ScrollArea>
            </div>

            <Button
              className="w-full"
              disabled={!formName || !formInstanceId || !formMessage || (formSelectedContacts.length === 0 && formTagIds.length === 0) || createMutation.isPending || formMediaUploading}
              onClick={() => createMutation.mutate()}
            >
              {(createMutation.isPending || formMediaUploading) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {formMediaUploading ? 'Mengupload media...' : `Buat Broadcast (${formSelectedContacts.length} kontak${formTagIds.length > 0 ? ` + ${formTagIds.length} tag` : ''})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{broadcasts.length}</p>
              <p className="text-xs text-muted-foreground">Total Broadcast</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Radio className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{broadcasts.filter((b: any) => b.status === 'SENDING').length}</p>
              <p className="text-xs text-muted-foreground">Sedang Mengirim</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Send className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{broadcasts.filter((b: any) => b.status === 'COMPLETED').length}</p>
              <p className="text-xs text-muted-foreground">Selesai</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Send className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {broadcasts.reduce((sum: number, b: any) => sum + (b.sent_count || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Pesan Terkirim</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Penerima</TableHead>
                <TableHead className="hidden md:table-cell">Terkirim</TableHead>
                <TableHead className="hidden lg:table-cell">Gagal</TableHead>
                <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
                <TableHead className="w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : broadcasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Belum ada broadcast
                  </TableCell>
                </TableRow>
              ) : (
                broadcasts.map((bc: any) => {
                  const sc = statusConfig[bc.status] || statusConfig.DRAFT;
                  return (
                    <TableRow key={bc.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{bc.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {bc.instance?.name || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-[10px]', sc.color)}>
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {bc.total_recipients || bc._count?.recipients || 0}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-emerald-600">
                        {bc.sent_count || 0}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-red-500">
                        {bc.failed_count || 0}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(bc.created_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(bc.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600"
                              onClick={() => startMutation.mutate(bc.id)}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {bc.status === 'SENDING' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600"
                              onClick={() => pauseMutation.mutate(bc.id)}
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(bc.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              onClick={() => cancelMutation.mutate(bc.id)}
                              title="Batalkan"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {bc.status !== 'SENDING' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              onClick={() => openConfirm({ title: 'Hapus broadcast ini?', description: 'Tindakan ini tidak bisa dibatalkan.', onConfirm: () => deleteMutation.mutate(bc.id) })}
                              title="Hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </FeatureGate>
  );
}
