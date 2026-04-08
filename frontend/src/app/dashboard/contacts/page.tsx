'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, Users, Phone, Building2, Loader2, Trash2, Edit, Tag, X, Tags, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, StickyNote, Send, GitMerge, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

const LABEL_COLORS = [
  { name: 'Biru', value: '#3b82f6' },
  { name: 'Hijau', value: '#22c55e' },
  { name: 'Merah', value: '#ef4444' },
  { name: 'Kuning', value: '#eab308' },
  { name: 'Ungu', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Oranye', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
];

interface TagItem {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  _count: { contact_tags: number };
}

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  company: string | null;
  source: string;
  stage: string;
  tags: { id: string; name: string; color: string }[];
  total_messages: number;
  lead_score: number;
  created_at: string;
}

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const [activeTab, setActiveTab] = useState<'contacts' | 'labels' | 'duplicates'>('contacts');

  // Contact state
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [page, setPage] = useState(1);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone_number: '', email: '', company: '', source: 'MANUAL', tags: [] as string[] });

  // Label state
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelForm, setLabelForm] = useState({ name: '', color: '#3b82f6', description: '' });

  // Bulk select state
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [bulkLabelDialogOpen, setBulkLabelDialogOpen] = useState(false);
  const [bulkTags, setBulkTags] = useState<string[]>([]);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<Array<{ phone_number: string; name?: string; email?: string; company?: string }>>([]);
  const [importTags, setImportTags] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Notes state
  const [notesContactId, setNotesContactId] = useState<string | null>(null);
  const [notesContactName, setNotesContactName] = useState('');
  const [newNote, setNewNote] = useState('');

  // Merge state
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeSearch, setMergeSearch] = useState('');

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, page, filterTag],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterTag) params.set('tag', filterTag);
      const { data } = await api.get(`/contacts?${params}`);
      return data;
    },
  });
  const contacts: Contact[] = data?.data || [];
  const meta = data?.meta;

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get('/contacts/tags');
      return (data.data || []) as TagItem[];
    },
  });

  const { data: duplicates = [], isLoading: dupLoading } = useQuery({
    queryKey: ['contact-duplicates'],
    queryFn: async () => {
      const { data } = await api.get('/contacts/duplicates');
      return data.data as Array<{
        match_type: string;
        match_value: string;
        contacts: Array<{ id: string; name: string | null; phone_number: string; email: string | null; total_messages: number; created_at: string; _count: { conversations: number; deals: number } }>;
      }>;
    },
    enabled: activeTab === 'duplicates',
  });

  // Contact mutations
  const createContactMutation = useMutation({
    mutationFn: async (input: typeof contactForm) => {
      await api.post('/contacts', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setContactDialogOpen(false);
      resetContactForm();
      toast.success('Kontak berhasil ditambahkan');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menambahkan kontak'),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) => {
      await api.patch(`/contacts/${id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setContactDialogOpen(false);
      resetContactForm();
      toast.success('Kontak berhasil diperbarui');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal memperbarui kontak'),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/contacts/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Kontak dihapus');
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ target_id, source_id }: { target_id: string; source_id: string }) => {
      await api.post('/contacts/merge', { target_id, source_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setMergeSourceId(null);
      setMergeTargetId('');
      setMergeSearch('');
      toast.success('Kontak berhasil digabung');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal merge kontak'),
  });

  // Notes queries & mutations
  const { data: notesData = [], isLoading: notesLoading } = useQuery({
    queryKey: ['contact-notes', notesContactId],
    queryFn: async () => {
      const { data } = await api.get(`/contacts/${notesContactId}/notes`);
      return data.data || [];
    },
    enabled: !!notesContactId,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/contacts/${notesContactId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', notesContactId] });
      setNewNote('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menambah catatan'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await api.delete(`/contacts/${notesContactId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', notesContactId] });
      toast.success('Catatan dihapus');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghapus catatan'),
  });

  // Label mutations
  const createLabelMutation = useMutation({
    mutationFn: async (input: typeof labelForm) => {
      await api.post('/contacts/tags', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setLabelDialogOpen(false);
      resetLabelForm();
      toast.success('Label berhasil dibuat');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal membuat label'),
  });

  const updateLabelMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) => {
      await api.patch(`/contacts/tags/${id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setLabelDialogOpen(false);
      resetLabelForm();
      toast.success('Label berhasil diperbarui');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal memperbarui label'),
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/contacts/tags/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Label dihapus');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghapus label'),
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async (payload: { contact_ids: string[]; tags: string[] }) => {
      const { data } = await api.post('/contacts/bulk-assign-tags', payload);
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setBulkLabelDialogOpen(false);
      setSelectedContacts([]);
      setBulkTags([]);
      toast.success(`Label berhasil di-assign ke ${result.assigned} kontak`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal assign label'),
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (payload: { contacts: Array<{ phone_number: string; name?: string; email?: string; company?: string; tags?: string[] }> }) => {
      const { data } = await api.post('/contacts/import', payload);
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setImportDialogOpen(false);
      resetImport();
      const lines = [`✅ ${result.created} kontak berhasil ditambahkan`, `⏭️ ${result.skipped} dilewati (sudah ada)`];
      if (result.errors?.length > 0) {
        lines.push(`❌ ${result.errors.length} gagal:`);
        result.errors.slice(0, 5).forEach((e: any) => lines.push(`  • ${e.phone_number}: ${e.reason}`));
        if (result.errors.length > 5) lines.push(`  ... dan ${result.errors.length - 5} lainnya`);
      }
      toast.success(lines.join('\n'), { duration: 8000, style: { whiteSpace: 'pre-line' } });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal import kontak'),
  });

  // Lead score recalc
  const recalcScoreMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/contacts/lead-score/recalc-all');
      return data.data as { updated: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Skor ${result.updated} kontak berhasil dihitung ulang`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal menghitung skor'),
  });

  // Helpers
  const resetContactForm = () => {
    setContactForm({ name: '', phone_number: '', email: '', company: '', source: 'MANUAL', tags: [] });
    setEditingContactId(null);
  };

  const resetLabelForm = () => {
    setLabelForm({ name: '', color: '#3b82f6', description: '' });
    setEditingLabelId(null);
  };

  const resetImport = () => {
    setImportData([]);
    setImportTags([]);
    setImportFileName('');
    setImportError('');
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const parseCSV = (text: string): Array<{ phone_number: string; name?: string; email?: string; company?: string }> => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('File CSV harus memiliki header dan minimal 1 baris data');

    const headerRaw = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
    const phoneIdx = headerRaw.findIndex((h) => ['phone', 'phone_number', 'telepon', 'nomor', 'no', 'whatsapp', 'wa', 'no_wa', 'no_telepon', 'nomer'].includes(h));
    const nameIdx = headerRaw.findIndex((h) => ['name', 'nama'].includes(h));
    const emailIdx = headerRaw.findIndex((h) => ['email', 'e-mail'].includes(h));
    const companyIdx = headerRaw.findIndex((h) => ['company', 'perusahaan', 'instansi'].includes(h));

    if (phoneIdx === -1) throw new Error('Kolom nomor telepon tidak ditemukan. Gunakan header: phone, telepon, nomor, wa, atau whatsapp');

    const result: Array<{ phone_number: string; name?: string; email?: string; company?: string }> = [];
    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
      const phone = cols[phoneIdx]?.replace(/[^0-9+]/g, '');
      if (!phone || phone.length < 10) continue;
      result.push({
        phone_number: phone,
        ...(nameIdx >= 0 && cols[nameIdx] ? { name: cols[nameIdx] } : {}),
        ...(emailIdx >= 0 && cols[emailIdx] ? { email: cols[emailIdx] } : {}),
        ...(companyIdx >= 0 && cols[companyIdx] ? { company: cols[companyIdx] } : {}),
      });
    }
    return result;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) throw new Error('Tidak ada data valid ditemukan di file');
        setImportData(parsed);
      } catch (err: any) {
        setImportError(err.message);
        setImportData([]);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csvContent = [
      'nama,phone,email,perusahaan',
      'Budi Santoso,6281234567890,budi@email.com,PT Maju Jaya',
      'Siti Aminah,6289876543210,siti@email.com,CV Berkah',
      'Ahmad Rizki,6285551234567,,',
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_kontak.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportContacts = async () => {
    setIsExporting(true);
    try {
      const { data } = await api.get('/contacts/export', { responseType: 'blob' });
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kontak_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Kontak berhasil di-export');
    } catch {
      toast.error('Gagal export kontak');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSubmit = () => {
    const contacts = importData.map((c) => ({
      ...c,
      tags: importTags.length > 0 ? importTags : undefined,
    }));
    importMutation.mutate({ contacts });
  };

  const toggleImportTag = (tagName: string) => {
    setImportTags((prev) => prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]);
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContacts((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map((c) => c.id));
    }
  };

  const toggleBulkTag = (tagName: string) => {
    setBulkTags((prev) => prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]);
  };

  const handleBulkAssign = () => {
    if (selectedContacts.length === 0 || bulkTags.length === 0) return;
    bulkAssignMutation.mutate({ contact_ids: selectedContacts, tags: bulkTags });
  };

  const openEditContact = (c: Contact) => {
    setEditingContactId(c.id);
    setContactForm({
      name: c.name,
      phone_number: c.phone_number,
      email: c.email || '',
      company: c.company || '',
      source: c.source,
      tags: c.tags?.map((t) => t.name) || [],
    });
    setContactDialogOpen(true);
  };

  const openEditLabel = (t: TagItem) => {
    setEditingLabelId(t.id);
    setLabelForm({ name: t.name, color: t.color || '#3b82f6', description: t.description || '' });
    setLabelDialogOpen(true);
  };

  const handleContactSubmit = () => {
    if (editingContactId) {
      updateContactMutation.mutate({ id: editingContactId, input: contactForm });
    } else {
      createContactMutation.mutate(contactForm);
    }
  };

  const handleLabelSubmit = () => {
    if (editingLabelId) {
      updateLabelMutation.mutate({ id: editingLabelId, input: labelForm });
    } else {
      createLabelMutation.mutate(labelForm);
    }
  };

  const toggleContactTag = (tagName: string) => {
    setContactForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagName) ? prev.tags.filter((t) => t !== tagName) : [...prev.tags, tagName],
    }));
  };

  const initials = (name: string) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const stageColor = (stage: string) => {
    switch (stage) {
      case 'LEAD': return 'bg-blue-100 text-blue-700';
      case 'PROSPECT': return 'bg-purple-100 text-purple-700';
      case 'CUSTOMER': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kontak</h1>
          <p className="text-sm text-muted-foreground">Kelola kontak dan label WhatsApp Anda</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'contacts' && (
            <>
              <Button variant="outline" size="sm" onClick={() => recalcScoreMutation.mutate()} disabled={recalcScoreMutation.isPending}>
                {recalcScoreMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />} Hitung Skor
              </Button>
              <Button variant="outline" onClick={exportContacts} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Export CSV
              </Button>
              <Button variant="outline" onClick={() => { resetImport(); setImportDialogOpen(true); }}>
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={() => { resetContactForm(); setContactDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Kontak
              </Button>
            </>
          )}
          {activeTab === 'labels' && (
            <Button onClick={() => { resetLabelForm(); setLabelDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Buat Label
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'contacts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('contacts')}
        >
          <Users className="h-4 w-4 inline mr-1.5" />Kontak
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'labels' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('labels')}
        >
          <Tags className="h-4 w-4 inline mr-1.5" />Label ({tags.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'duplicates' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('duplicates')}
        >
          <GitMerge className="h-4 w-4 inline mr-1.5" />Duplikat
        </button>
      </div>

      {/* ============ CONTACTS TAB ============ */}
      {activeTab === 'contacts' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{meta?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Kontak</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contacts.filter((c) => c.stage === 'LEAD').length}</p>
                  <p className="text-xs text-muted-foreground">Leads</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contacts.filter((c) => c.stage === 'CUSTOMER').length}</p>
                  <p className="text-xs text-muted-foreground">Customers</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Tags className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tags.length}</p>
                  <p className="text-xs text-muted-foreground">Label</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, telepon, email..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={filterTag} onValueChange={(v) => { setFilterTag(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Label</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color || '#6b7280' }} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk action bar */}
          {selectedContacts.length > 0 && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
              <span className="text-sm font-medium">{selectedContacts.length} kontak dipilih</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setBulkTags([]); setBulkLabelDialogOpen(true); }}>
                <Tag className="h-3 w-3 mr-1" /> Assign Label
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedContacts([])}>
                <X className="h-3 w-3 mr-1" /> Batal
              </Button>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead className="hidden md:table-cell">Telepon</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="hidden lg:table-cell">Stage</TableHead>
                    <TableHead className="hidden lg:table-cell">Skor</TableHead>
                    <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        Belum ada kontak
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact.id} className={selectedContacts.includes(contact.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={() => toggleSelectContact(contact.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {initials(contact.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <button
                                className="text-sm font-medium hover:underline text-left"
                                onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                              >
                                {contact.name}
                              </button>
                              {contact.email && (
                                <p className="text-xs text-muted-foreground">{contact.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{contact.phone_number}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.tags && contact.tags.length > 0 ? (
                              contact.tags.map((t) => (
                                <Badge
                                  key={t.id}
                                  variant="secondary"
                                  className="text-[10px] gap-1"
                                  style={{ backgroundColor: (t.color || '#6b7280') + '20', color: t.color || '#6b7280', borderColor: (t.color || '#6b7280') + '40' }}
                                >
                                  {t.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="secondary" className={`text-[10px] ${stageColor(contact.stage)}`}>
                            {contact.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  contact.lead_score >= 70 ? 'bg-green-500' : contact.lead_score >= 40 ? 'bg-yellow-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${contact.lead_score}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{contact.lead_score}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {format(new Date(contact.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Catatan" onClick={() => { setNotesContactId(contact.id); setNotesContactName(contact.name || contact.phone_number); }}>
                              <StickyNote className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditContact(contact)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Gabung kontak" onClick={() => { setMergeSourceId(contact.id); setMergeTargetId(''); setMergeSearch(''); }}>
                              <GitMerge className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => openConfirm({ title: 'Hapus kontak ini?', description: 'Kontak dan riwayat chatnya akan dihapus permanen.', onConfirm: () => deleteContactMutation.mutate(contact.id) })}
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

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Halaman {meta.page} dari {meta.totalPages} ({meta.total} kontak)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
                <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Selanjutnya</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ LABELS TAB ============ */}
      {activeTab === 'labels' && (
        <>
          {tags.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Tags className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">Belum ada label</h3>
                <p className="text-sm text-muted-foreground mb-4">Buat label untuk mengelompokkan kontak Anda</p>
                <Button onClick={() => { resetLabelForm(); setLabelDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Buat Label Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tags.map((tag) => (
                <Card key={tag.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (tag.color || '#6b7280') + '20' }}>
                          <Tag className="h-5 w-5" style={{ color: tag.color || '#6b7280' }} />
                        </div>
                        <div>
                          <p className="font-semibold">{tag.name}</p>
                          <p className="text-xs text-muted-foreground">{tag._count.contact_tags} kontak</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLabel(tag)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => openConfirm({ title: `Hapus label "${tag.name}"?`, description: 'Label akan dihapus, kontak tidak akan terpengaruh.', onConfirm: () => deleteLabelMutation.mutate(tag.id) })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {tag.description && (
                      <p className="text-xs text-muted-foreground mt-2">{tag.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ DUPLICATES TAB ============ */}
      {activeTab === 'duplicates' && (
        <>
          {dupLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : duplicates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Tidak ada duplikat</h3>
                <p className="text-sm text-muted-foreground">Semua kontak Anda sudah unik. Tidak ditemukan kontak duplikat berdasarkan nomor telepon atau nama.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Ditemukan <span className="font-semibold text-foreground">{duplicates.length}</span> grup kontak duplikat. Pilih dua kontak untuk digabung.</p>
              {duplicates.map((group, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {group.match_type === 'phone' ? 'Telepon sama' : 'Nama sama'}
                      </Badge>
                      <span className="text-sm font-medium text-muted-foreground">{group.match_value}</span>
                      <span className="text-xs text-muted-foreground">({group.contacts.length} kontak)</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Telepon</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Pesan</TableHead>
                          <TableHead className="text-center">Percakapan</TableHead>
                          <TableHead className="text-center">Deal</TableHead>
                          <TableHead>Dibuat</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.contacts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name || '-'}</TableCell>
                            <TableCell className="text-sm">{c.phone_number}</TableCell>
                            <TableCell className="text-sm">{c.email || '-'}</TableCell>
                            <TableCell className="text-center">{c.total_messages}</TableCell>
                            <TableCell className="text-center">{c._count.conversations}</TableCell>
                            <TableCell className="text-center">{c._count.deals}</TableCell>
                            <TableCell className="text-sm">{format(new Date(c.created_at), 'dd/MM/yy')}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  const others = group.contacts.filter((o) => o.id !== c.id);
                                  setMergeSourceId(others[0].id);
                                  setMergeTargetId(c.id);
                                  setMergeSearch(c.name || c.phone_number);
                                }}
                              >
                                <GitMerge className="h-3 w-3" /> Gabung ke sini
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ CONTACT DIALOG ============ */}
      <Dialog open={contactDialogOpen} onOpenChange={(open) => { if (!open) { resetContactForm(); } setContactDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContactId ? 'Edit Kontak' : 'Tambah Kontak Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                placeholder="John Doe"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nomor WhatsApp</Label>
              <Input
                placeholder="6281234567890"
                value={contactForm.phone_number}
                onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@contoh.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Perusahaan</Label>
                <Input
                  placeholder="PT Contoh"
                  value={contactForm.company}
                  onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            {/* Tag assignment */}
            <div>
              <Label className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> Label</Label>
              <p className="text-xs text-muted-foreground mb-2">Pilih label untuk kontak ini</p>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant={contactForm.tags.includes(t.name) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      style={
                        contactForm.tags.includes(t.name)
                          ? { backgroundColor: t.color || undefined, borderColor: t.color || undefined }
                          : { borderColor: (t.color || '#6b7280') + '60', color: t.color || undefined }
                      }
                      onClick={() => toggleContactTag(t.name)}
                    >
                      <Tag className="h-3 w-3" />
                      {t.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Belum ada label. Buat label di tab Label terlebih dahulu.</p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleContactSubmit}
              disabled={!contactForm.name || !contactForm.phone_number || createContactMutation.isPending || updateContactMutation.isPending}
            >
              {(createContactMutation.isPending || updateContactMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingContactId ? 'Simpan Perubahan' : 'Tambah Kontak'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ LABEL DIALOG ============ */}
      <Dialog open={labelDialogOpen} onOpenChange={(open) => { if (!open) { resetLabelForm(); } setLabelDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLabelId ? 'Edit Label' : 'Buat Label Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Label</Label>
              <Input
                placeholder="Contoh: Program Tahfidz, Kelas Batch 5"
                value={labelForm.name}
                onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      labelForm.color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setLabelForm({ ...labelForm, color: c.value })}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Input
                placeholder="Deskripsi singkat label ini"
                value={labelForm.description}
                onChange={(e) => setLabelForm({ ...labelForm, description: e.target.value })}
              />
            </div>

            {/* Preview */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Preview:</p>
              <Badge
                variant="secondary"
                className="text-xs gap-1"
                style={{ backgroundColor: labelForm.color + '20', color: labelForm.color, borderColor: labelForm.color + '40' }}
              >
                <Tag className="h-3 w-3" />
                {labelForm.name || 'Nama Label'}
              </Badge>
            </div>

            <Button
              className="w-full"
              onClick={handleLabelSubmit}
              disabled={!labelForm.name || createLabelMutation.isPending || updateLabelMutation.isPending}
            >
              {(createLabelMutation.isPending || updateLabelMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingLabelId ? 'Simpan Perubahan' : 'Buat Label'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ BULK ASSIGN LABEL DIALOG ============ */}
      <Dialog open={bulkLabelDialogOpen} onOpenChange={setBulkLabelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Label ke {selectedContacts.length} Kontak</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pilih label yang akan di-assign ke kontak yang dipilih</p>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant={bulkTags.includes(t.name) ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    style={
                      bulkTags.includes(t.name)
                        ? { backgroundColor: t.color || undefined, borderColor: t.color || undefined }
                        : { borderColor: (t.color || '#6b7280') + '60', color: t.color || undefined }
                    }
                    onClick={() => toggleBulkTag(t.name)}
                  >
                    <Tag className="h-3 w-3" />
                    {t.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada label. Buat label di tab Label terlebih dahulu.</p>
            )}
            <Button
              className="w-full"
              onClick={handleBulkAssign}
              disabled={bulkTags.length === 0 || bulkAssignMutation.isPending}
            >
              {bulkAssignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Assign {bulkTags.length} Label ke {selectedContacts.length} Kontak
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ IMPORT DIALOG ============ */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) resetImport(); setImportDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Import Kontak dari CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Download template + info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Belum punya file CSV?</p>
                  <p className="text-xs text-muted-foreground">Download template lalu isi dengan data kontak Anda</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" /> Download Template
                </Button>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">Kolom wajib: <strong>phone</strong> (atau nomor/wa/telepon). Opsional: nama, email, perusahaan. Delimiter: koma, titik koma, atau tab.</p>
            </div>

            {/* File upload */}
            <div>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleCSVUpload}
              />
              <Button
                variant="outline"
                className="w-full h-20 border-dashed"
                onClick={() => csvInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">{importFileName || 'Pilih file CSV'}</span>
                </div>
              </Button>
            </div>

            {/* Error */}
            {importError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {importError}
              </div>
            )}

            {/* Preview */}
            {importData.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {importData.length} kontak valid ditemukan
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">No</TableHead>
                        <TableHead className="text-xs">Telepon</TableHead>
                        <TableHead className="text-xs">Nama</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-xs font-mono">{row.phone_number}</TableCell>
                          <TableCell className="text-xs">{row.name || '-'}</TableCell>
                          <TableCell className="text-xs">{row.email || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importData.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ...dan {importData.length - 10} kontak lainnya
                    </p>
                  )}
                </div>

                <Separator />

                {/* Auto-assign labels */}
                <div>
                  <Label className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> Assign Label (opsional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Semua kontak yang diimport akan otomatis mendapat label ini</p>
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <Button
                          key={t.id}
                          type="button"
                          variant={importTags.includes(t.name) ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          style={
                            importTags.includes(t.name)
                              ? { backgroundColor: t.color || undefined, borderColor: t.color || undefined }
                              : { borderColor: (t.color || '#6b7280') + '60', color: t.color || undefined }
                          }
                          onClick={() => toggleImportTag(t.name)}
                        >
                          <Tag className="h-3 w-3" />
                          {t.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Belum ada label. Buat label di tab Label terlebih dahulu.</p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleImportSubmit}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Import {importData.length} Kontak
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ NOTES DIALOG ============ */}
      <Dialog open={!!notesContactId} onOpenChange={(open) => { if (!open) { setNotesContactId(null); setNewNote(''); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" /> Catatan — {notesContactName}
            </DialogTitle>
          </DialogHeader>

          {/* New note input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Tulis catatan baru..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[60px] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && newNote.trim()) {
                  e.preventDefault();
                  createNoteMutation.mutate(newNote.trim());
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 h-[60px] w-10"
              disabled={!newNote.trim() || createNoteMutation.isPending}
              onClick={() => { if (newNote.trim()) createNoteMutation.mutate(newNote.trim()); }}
            >
              {createNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* Notes list */}
          <ScrollArea className="flex-1 max-h-[400px]">
            {notesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : notesData.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Belum ada catatan
              </div>
            ) : (
              <div className="space-y-3">
                {notesData.map((note: any) => (
                  <div key={note.id} className="group border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => openConfirm({ title: 'Hapus catatan ini?', description: 'Catatan akan dihapus permanen.', onConfirm: () => deleteNoteMutation.mutate(note.id) })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span className="font-medium">{note.user?.name || 'Unknown'}</span>
                      <span>·</span>
                      <span>{format(new Date(note.created_at), 'dd MMM yyyy HH:mm')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Merge Contact Dialog */}
      <Dialog open={!!mergeSourceId} onOpenChange={(open) => { if (!open) { setMergeSourceId(null); setMergeTargetId(''); setMergeSearch(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gabung Kontak</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Data dari kontak sumber akan dipindahkan ke kontak tujuan (chat, deals, notes, tags).
            Kontak sumber akan dihapus setelah merge.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Kontak Sumber (akan dihapus)</Label>
              <div className="mt-1 p-2 bg-muted rounded text-sm font-medium">
                {contacts.find((c: any) => c.id === mergeSourceId)?.name || contacts.find((c: any) => c.id === mergeSourceId)?.phone_number || '-'}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Kontak Tujuan (utama)</Label>
              <Input
                placeholder="Cari kontak tujuan..."
                className="mt-1"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                autoFocus
              />
              {mergeSearch && (
                <div className="mt-1 max-h-40 overflow-y-auto border rounded">
                  {contacts
                    .filter((c: any) => c.id !== mergeSourceId && (c.name?.toLowerCase().includes(mergeSearch.toLowerCase()) || c.phone_number.includes(mergeSearch)))
                    .slice(0, 8)
                    .map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => { setMergeTargetId(c.id); setMergeSearch(c.name || c.phone_number); }}
                      >
                        <span className="font-medium">{c.name || c.phone_number}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{c.phone_number}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setMergeSourceId(null)}>Batal</Button>
            <Button
              disabled={!mergeTargetId || mergeMutation.isPending}
              onClick={() =>
                openConfirm({
                  title: 'Yakin gabung kontak?',
                  description: 'Semua data dari kontak sumber akan dipindahkan dan kontak sumber dihapus. Aksi ini tidak bisa dibatalkan.',
                  onConfirm: () => mergeMutation.mutate({ target_id: mergeTargetId, source_id: mergeSourceId! }),
                })
              }
            >
              {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <GitMerge className="mr-2 h-4 w-4" />
              Gabung
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
