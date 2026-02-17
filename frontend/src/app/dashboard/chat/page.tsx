'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { API_BASE_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Send,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Clock,
  MessageSquare,
  User,
  ArrowLeft,
  X,
  FileText,
  Film,
  Music,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  chat_jid: string;
  contact: { id: string; name: string; phone_number: string; avatar_url: string | null };
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  assigned_to_user: { id: string; name: string } | null;
}

interface Message {
  id: string;
  direction: 'INCOMING' | 'OUTGOING';
  message_type: string;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  status: string;
  created_at: string;
  sent_by_user: { id: string; name: string } | null;
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations, error: convError } = useQuery({
    queryKey: ['conversations', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const { data } = await api.get(`/conversations?${params}`);
      return (data.data || []) as Conversation[];
    },
    refetchOnMount: 'always',
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  // Fetch messages for selected conversation (poll every 15s for new messages)
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await api.get(`/conversations/${selectedId}/messages`);
      return data.data as Message[];
    },
    enabled: !!selectedId,
    refetchInterval: 60_000,
  });

  // Selected conversation detail
  const selectedConv = conversations.find((c) => c.id === selectedId);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: { content?: string; media_url?: string; media_type?: string; caption?: string }) => {
      const { data } = await api.post(`/conversations/${selectedId}/messages`, payload);
      return data;
    },
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageText('');
      clearAttachment();
      if (resp?.data?.status === 'FAILED') {
        toast.error(resp?.data?.error_message || 'Gagal mengirim pesan ke WhatsApp');
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Gagal mengirim pesan');
    },
  });

  const getMediaTypeFromFile = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    if (attachedPreview) URL.revokeObjectURL(attachedPreview);
    setAttachedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Size validation
    const maxSize = file.type.startsWith('video/') ? 64 * 1024 * 1024
      : file.type.startsWith('image/') || file.type.startsWith('audio/') ? 16 * 1024 * 1024
      : 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File terlalu besar. Maksimal ${Math.round(maxSize / 1024 / 1024)}MB.`);
      return;
    }
    setAttachedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setAttachedPreview(URL.createObjectURL(file));
    } else {
      setAttachedPreview(null);
    }
  };

  // Track selectedId in a ref so socket handlers always see latest value
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Socket.IO realtime — listen for events (connection managed by auth store)
  useEffect(() => {
    const socket = getSocket();
    // Ensure connected (auth store should handle this, but fallback just in case)
    if (!socket.connected && typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        socket.auth = { token };
        socket.connect();
      }
    }

    const handleChatMessage = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      const convId = data.conversation?.id || data.conversation_id;
      if (convId === selectedIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedIdRef.current] });
      }
    };

    const handleMessageStatus = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.conversation_id === selectedIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedIdRef.current] });
      }
    };

    socket.on('chat:message', handleChatMessage);
    socket.on('message:status', handleMessageStatus);

    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('message:status', handleMessageStatus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // Join conversation room + mark as read
  useEffect(() => {
    if (!selectedId) return;
    const socket = getSocket();
    socket.emit('conversation:join', selectedId);
    // Mark conversation as read when opened
    api.post(`/conversations/${selectedId}/read`).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }).catch(() => {});
    return () => {
      socket.emit('conversation:leave', selectedId);
    };
  }, [selectedId, queryClient]);

  // Auto scroll to bottom — use setTimeout to wait for DOM render,
  // and scroll the ScrollArea viewport directly for reliability.
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!selectedId) return;
    if (!messageText.trim() && !attachedFile) return;

    if (attachedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', attachedFile);
        const mediaType = getMediaTypeFromFile(attachedFile);
        formData.append('type', mediaType);
        const { data: uploadResp } = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const mediaUrl = uploadResp.data?.url;
        if (!mediaUrl) throw new Error('Upload gagal: URL tidak ditemukan');
        sendMutation.mutate({
          media_url: mediaUrl,
          media_type: mediaType,
          caption: messageText.trim() || undefined,
        });
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err.message || 'Gagal upload file');
      } finally {
        setIsUploading(false);
      }
    } else {
      sendMutation.mutate({ content: messageText.trim() });
    }
  }, [messageText, selectedId, sendMutation, attachedFile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'DELIVERED': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'READ': return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  // Media URLs in DB point to WA API (e.g. http://localhost:3001/media/...).
  // Browser <img>/<video>/<audio> tags cannot send X-API-Key header,
  // so we proxy through CRM backend public endpoint /media/wa-proxy?url=...
  const getMediaUrl = (url: string | null): string => {
    if (!url) return '';
    // Normalize old /uploads/ paths to /media/
    const normalized = url.replace('/uploads/', '/media/');
    // If it's a full URL (http/https), proxy through CRM backend
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return `${API_BASE_URL}/media/wa-proxy?url=${encodeURIComponent(normalized)}`;
    }
    // Relative path — also proxy (prepend WA API base if needed)
    return `${API_BASE_URL}/media/wa-proxy?url=${encodeURIComponent(normalized)}`;
  };

  const isLidNumber = (phone: string) => /^\d{10,}$/.test(phone) && !phone.startsWith('62') && !phone.startsWith('1');

  const getDisplayName = (conv: Conversation) => {
    const name = conv.contact?.name;
    const phone = conv.contact?.phone_number;
    const isLid = conv.chat_jid?.endsWith('@lid');
    // If name is different from phone number, use name
    if (name && name !== phone) return name;
    // If @lid with no real name, show "WhatsApp User"
    if (isLid || isLidNumber(phone)) return `WhatsApp User (${phone?.slice(-4)})`;
    // Normal phone number
    return phone || 'Unknown';
  };

  const getDisplayPhone = (conv: Conversation) => {
    const phone = conv.contact?.phone_number;
    const isLid = conv.chat_jid?.endsWith('@lid');
    if (isLid || isLidNumber(phone || '')) return '';
    return phone || '';
  };

  const initials = (name: string) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-xl border bg-card overflow-hidden">
      {/* Conversation List */}
      <div className={cn(
        'w-full md:w-[340px] lg:w-[380px] flex flex-col border-r',
        mobileShowChat && 'hidden md:flex'
      )}>
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari percakapan..."
              className="pl-9 bg-muted/50 border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation items */}
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">Memuat percakapan...</p>
            </div>
          ) : convError ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-500">
              <p className="text-sm">Error: {(convError as any)?.message}</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Belum ada percakapan</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50',
                  selectedId === conv.id && 'bg-primary/5 border-l-2 border-l-primary'
                )}
                onClick={() => {
                  setSelectedId(conv.id);
                  setMobileShowChat(true);
                }}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials(getDisplayName(conv))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{getDisplayName(conv)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {conv.last_message_preview || 'Belum ada pesan'}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge className="h-5 min-w-[20px] flex items-center justify-center rounded-full text-[10px] bg-primary">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        'flex-1 flex flex-col',
        !mobileShowChat && 'hidden md:flex'
      )}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
              <MessageSquare className="h-10 w-10 text-primary/50" />
            </div>
            <p className="text-lg font-medium">Pilih percakapan</p>
            <p className="text-sm mt-1">Pilih percakapan dari daftar untuk mulai chat</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setMobileShowChat(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials(selectedConv ? getDisplayName(selectedConv) : '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{selectedConv ? getDisplayName(selectedConv) : ''}</p>
                <p className="text-xs text-muted-foreground">{selectedConv ? getDisplayPhone(selectedConv) : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                {selectedConv?.assigned_to_user && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <User className="h-3 w-3" />
                    {selectedConv.assigned_to_user.name}
                  </Badge>
                )}
                <Badge variant={selectedConv?.status === 'OPEN' ? 'default' : 'secondary'} className="text-[10px]">
                  {selectedConv?.status}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3 max-w-3xl mx-auto">
                {messages.filter((msg) => msg.content || msg.media_url || msg.message_type !== 'TEXT').map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                        msg.direction === 'OUTGOING'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}
                    >
                      {msg.media_url && ['IMAGE', 'VIEW_ONCE'].includes(msg.message_type) && (
                        <img src={getMediaUrl(msg.media_url)} alt="" className="rounded-lg mb-1 max-h-60 object-cover" />
                      )}
                      {msg.media_url && msg.message_type === 'VIDEO' && (
                        <video src={getMediaUrl(msg.media_url)} controls className="rounded-lg mb-1 max-h-60" />
                      )}
                      {msg.media_url && msg.message_type === 'AUDIO' && (
                        <audio src={getMediaUrl(msg.media_url)} controls className="mb-1 max-w-full" />
                      )}
                      {msg.media_url && msg.message_type === 'DOCUMENT' && (
                        <a href={getMediaUrl(msg.media_url)} target="_blank" rel="noopener noreferrer" className="underline text-xs block mb-1">📎 Buka Dokumen</a>
                      )}
                      {msg.media_url && msg.message_type === 'STICKER' && (
                        <img src={getMediaUrl(msg.media_url)} alt="Sticker" className="max-h-32 mb-1" />
                      )}
                      {/* Hide placeholder text for media types when media_url is present */}
                      {!(msg.media_url && ['STICKER', 'IMAGE', 'VIDEO', 'AUDIO', 'VIEW_ONCE'].includes(msg.message_type) && (!msg.content || msg.content.startsWith('['))) && (
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content || (msg.caption) || `[${msg.message_type}]`}
                        </p>
                      )}
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'
                      )}>
                        <span className={cn(
                          'text-[10px]',
                          msg.direction === 'OUTGOING' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        {msg.direction === 'OUTGOING' && getStatusIcon(msg.status)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-3">
              {/* Attachment Preview */}
              {attachedFile && (
                <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-muted/50 rounded-lg max-w-3xl mx-auto">
                  {attachedPreview && attachedFile.type.startsWith('image/') ? (
                    <img src={attachedPreview} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : attachedFile.type.startsWith('video/') ? (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><Film className="h-5 w-5 text-muted-foreground" /></div>
                  ) : attachedFile.type.startsWith('audio/') ? (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><Music className="h-5 w-5 text-muted-foreground" /></div>
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB · {getMediaTypeFromFile(attachedFile)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearAttachment}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/mpeg,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                onChange={handleFileSelect}
              />
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Ketik pesan..."
                    className="pr-10 bg-muted/50 border-0"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                    <Smile className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleSend}
                  disabled={(!messageText.trim() && !attachedFile) || sendMutation.isPending || isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
