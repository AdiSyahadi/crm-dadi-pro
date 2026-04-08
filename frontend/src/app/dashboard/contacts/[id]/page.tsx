'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  MessageSquare,
  StickyNote,
  Send,
  Trash2,
  Loader2,
  Calendar,
  Tag,
  DollarSign,
  History,
  Handshake,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  source: string;
  stage: string;
  is_subscribed: boolean;
  is_blocked: boolean;
  total_messages: number;
  first_message_at: string | null;
  last_message_at: string | null;
  created_at: string;
  tags: { id: string; name: string; color: string | null }[];
  conversations: {
    id: string;
    chat_jid: string;
    status: string;
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
  }[];
  deals: {
    id: string;
    title: string;
    stage: string;
    value: number | null;
    closed_status: string | null;
  }[];
}

interface ContactNote {
  id: string;
  content: string;
  created_at: string;
  user: { id: string; name: string };
}

const stageLabel: Record<string, string> = {
  NEW: 'Baru',
  CONTACTED: 'Dihubungi',
  QUALIFIED: 'Berkualitas',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negosiasi',
  WON: 'Menang',
  LOST: 'Kalah',
};

const stageColor: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-emerald-100 text-emerald-800',
  PROPOSAL: 'bg-purple-100 text-purple-800',
  NEGOTIATION: 'bg-orange-100 text-orange-800',
  WON: 'bg-green-100 text-green-800',
  LOST: 'bg-red-100 text-red-800',
};

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const contactId = params.id as string;
  const [newNote, setNewNote] = useState('');

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const { data } = await api.get(`/contacts/${contactId}`);
      return data.data;
    },
    enabled: !!contactId,
  });

  const { data: notes = [] } = useQuery<ContactNote[]>({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      const { data } = await api.get(`/contacts/${contactId}/notes`);
      return data.data;
    },
    enabled: !!contactId,
  });

  const { data: timeline = [] } = useQuery<Array<{ type: string; timestamp: string; data: any }>>({
    queryKey: ['contact-timeline', contactId],
    queryFn: async () => {
      const { data } = await api.get(`/contacts/${contactId}/timeline?limit=100`);
      return data.data;
    },
    enabled: !!contactId,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post(`/contacts/${contactId}/notes`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] });
      setNewNote('');
    },
    onError: () => toast.error('Gagal menambah catatan'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await api.delete(`/contacts/${contactId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] });
      toast.success('Catatan dihapus');
    },
    onError: () => toast.error('Gagal menghapus catatan'),
  });

  const handleDeleteNote = (noteId: string) => {
    openConfirm({
      title: 'Hapus Catatan',
      description: 'Catatan ini akan dihapus permanen.',
      confirmText: 'Hapus',
      variant: 'destructive',
      onConfirm: () => deleteNoteMutation.mutate(noteId),
    });
  };

  const handleSubmitNote = () => {
    if (!newNote.trim()) return;
    createNoteMutation.mutate(newNote.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/contacts')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        <p className="text-center text-muted-foreground">Kontak tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/contacts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {(contact.name || contact.phone_number).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{contact.name || contact.phone_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn('text-xs', stageColor[contact.stage] || 'bg-muted text-muted-foreground')}>
                {stageLabel[contact.stage] || contact.stage}
              </Badge>
              {contact.is_blocked && <Badge variant="destructive" className="text-xs">Diblokir</Badge>}
              {!contact.is_subscribed && <Badge variant="outline" className="text-xs">Berhenti Langganan</Badge>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => {
          const conv = contact.conversations[0];
          if (conv) router.push(`/dashboard/chat?id=${conv.id}`);
          else toast.info('Belum ada percakapan dengan kontak ini');
        }}>
          <MessageSquare className="h-4 w-4 mr-2" /> Buka Chat
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Contact Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informasi Kontak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Phone} label="Telepon" value={contact.phone_number} />
              {contact.email && <InfoRow icon={Mail} label="Email" value={contact.email} />}
              {contact.company && <InfoRow icon={Building2} label="Perusahaan" value={contact.company} />}
              {contact.job_title && <InfoRow icon={Briefcase} label="Jabatan" value={contact.job_title} />}
              {(contact.address || contact.city) && (
                <InfoRow icon={MapPin} label="Alamat" value={[contact.address, contact.city].filter(Boolean).join(', ')} />
              )}
              <Separator />
              <InfoRow icon={Calendar} label="Dibuat" value={format(new Date(contact.created_at), 'dd MMM yyyy')} />
              {contact.first_message_at && (
                <InfoRow icon={MessageSquare} label="Pesan Pertama" value={format(new Date(contact.first_message_at), 'dd MMM yyyy')} />
              )}
              {contact.last_message_at && (
                <InfoRow icon={MessageSquare} label="Pesan Terakhir" value={format(new Date(contact.last_message_at), 'dd MMM yyyy')} />
              )}
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Total Pesan:</span>
                <span className="font-medium">{contact.total_messages}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Label
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline" style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Notes */}
          {contact.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Catatan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Conversations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Percakapan ({contact.conversations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada percakapan</p>
              ) : (
                <div className="space-y-2">
                  {contact.conversations.map((conv) => (
                    <button
                      key={conv.id}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/dashboard/chat?id=${conv.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={conv.status === 'OPEN' ? 'default' : 'secondary'} className="text-[10px]">
                            {conv.status === 'OPEN' ? 'Aktif' : 'Ditutup'}
                          </Badge>
                          {conv.unread_count > 0 && (
                            <Badge className="bg-red-500 text-white text-[10px]">{conv.unread_count}</Badge>
                          )}
                        </div>
                        {conv.last_message_preview && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{conv.last_message_preview}</p>
                        )}
                      </div>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(conv.last_message_at), 'dd/MM HH:mm')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Deal ({contact.deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada deal</p>
              ) : (
                <div className="space-y-2">
                  {contact.deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push('/dashboard/deals')}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{deal.stage}</Badge>
                          {deal.closed_status && (
                            <Badge variant={deal.closed_status === 'WON' ? 'default' : 'destructive'} className="text-[10px]">
                              {deal.closed_status === 'WON' ? 'Menang' : 'Kalah'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {deal.value != null && (
                        <span className="text-sm font-semibold text-emerald-600 shrink-0">
                          Rp {deal.value.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <StickyNote className="h-4 w-4" /> Catatan Internal ({notes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Tulis catatan..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitNote();
                    }
                  }}
                  className="min-h-[60px] resize-none"
                />
                <Button
                  size="icon"
                  className="shrink-0 h-[60px]"
                  onClick={handleSubmitNote}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                >
                  {createNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {notes.length > 0 && (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="group flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {note.user.name} · {format(new Date(note.created_at), 'dd MMM yyyy HH:mm')}
                          </p>
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" /> Timeline Aktivitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada aktivitas</p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="relative pl-6 space-y-4">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                    {timeline.map((item, i) => (
                      <div key={i} className="relative">
                        <div className={cn(
                          'absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-background',
                          item.type === 'note' ? 'bg-blue-500' :
                          item.type === 'deal' ? 'bg-emerald-500' :
                          item.type === 'conversation' ? 'bg-purple-500' :
                          item.type === 'tag_assigned' ? 'bg-amber-500' :
                          'bg-muted-foreground'
                        )} />
                        <div className="text-sm">
                          <TimelineEntry item={item} />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(item.timestamp), 'dd MMM yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({ item }: { item: { type: string; data: any } }) {
  switch (item.type) {
    case 'note':
      return (
        <div className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-medium">{item.data.user?.name || 'User'}</span>
          <span className="text-muted-foreground">menambahkan catatan</span>
        </div>
      );
    case 'deal':
      return (
        <div className="flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-muted-foreground">Deal</span>
          <span className="font-medium">{item.data.title}</span>
          <Badge variant="outline" className="text-[10px]">{item.data.stage}</Badge>
        </div>
      );
    case 'conversation':
      return (
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
          <span className="text-muted-foreground">Percakapan</span>
          <Badge variant={item.data.status === 'OPEN' ? 'default' : 'secondary'} className="text-[10px]">
            {item.data.status}
          </Badge>
          {item.data.assigned_to && <span className="text-muted-foreground text-xs">→ {item.data.assigned_to.name}</span>}
        </div>
      );
    case 'tag_assigned':
      return (
        <div className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-muted-foreground">Label ditambahkan:</span>
          <Badge variant="outline" style={item.data.tag?.color ? { borderColor: item.data.tag.color, color: item.data.tag.color } : undefined}>
            {item.data.tag?.name}
          </Badge>
        </div>
      );
    case 'activity':
      return (
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{item.data.action}</span>
          {item.data.entity_type && <span className="text-xs text-muted-foreground">({item.data.entity_type})</span>}
        </div>
      );
    default:
      return <span className="text-muted-foreground">Aktivitas</span>;
  }
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
