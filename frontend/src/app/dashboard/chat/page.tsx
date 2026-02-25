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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Send,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  CheckCircle,
  RotateCcw,
  Clock,
  MessageSquare,
  User,
  ArrowLeft,
  X,
  FileText,
  Film,
  Music,
  Loader2,
  UserCog,
  Tag,
  Bold,
  Italic,
  Strikethrough,
  Code,
  ListOrdered,
  List,
  Quote,
  Trash2,
  Ban,
  Pencil,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatWAText } from '@/lib/format-wa-text';
import { format } from 'date-fns';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Conversation {
  id: string;
  chat_jid: string;
  contact: { id: string; name: string; phone_number: string; avatar_url: string | null };
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  assigned_to_user: { id: string; name: string } | null;
  labels?: { id: string; label: string; color: string | null }[];
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
  is_edited?: boolean;
  edited_at?: string | null;
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isAgent = user?.role === 'AGENT';
  const [chatFilter, setChatFilter] = useState<'all' | 'mine' | 'unassigned'>(isAgent ? 'mine' : 'all');
  const [agentFilter, setAgentFilter] = useState<string>('');  // userId or '' for all
  const [labelFilter, setLabelFilter] = useState<string>('');  // label string or '' for all
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const formatBarRef = useRef<HTMLDivElement>(null);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Detect text selection in textarea
  const handleTextSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const hasSelection = ta.selectionStart !== ta.selectionEnd;
    setShowFormatBar(hasSelection);
  }, []);

  // Close format bar on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (formatBarRef.current && !formatBarRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowFormatBar(false);
      }
    };
    if (showFormatBar) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFormatBar]);

  // Apply formatting to selected text
  const applyFormat = useCallback((type: 'bold' | 'italic' | 'strikethrough' | 'code' | 'ordered' | 'unordered' | 'quote') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = messageText.substring(start, end);
    if (!selected) return;

    let result: string;
    let cursorEnd: number;

    if (type === 'bold') {
      result = `*${selected}*`;
      cursorEnd = start + result.length;
    } else if (type === 'italic') {
      result = `_${selected}_`;
      cursorEnd = start + result.length;
    } else if (type === 'strikethrough') {
      result = `~${selected}~`;
      cursorEnd = start + result.length;
    } else if (type === 'code') {
      result = selected.includes('\n') ? `\`\`\`${selected}\`\`\`` : `\`${selected}\``;
      cursorEnd = start + result.length;
    } else if (type === 'ordered') {
      const lines = selected.split('\n');
      result = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
      cursorEnd = start + result.length;
    } else if (type === 'unordered') {
      const lines = selected.split('\n');
      result = lines.map((l) => `• ${l}`).join('\n');
      cursorEnd = start + result.length;
    } else {
      // quote
      const lines = selected.split('\n');
      result = lines.map((l) => `> ${l}`).join('\n');
      cursorEnd = start + result.length;
    }

    const nv = messageText.substring(0, start) + result + messageText.substring(end);
    setMessageText(nv);
    setShowFormatBar(false);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(cursorEnd, cursorEnd); });
  }, [messageText]);

  // Auto-resize textarea to fit content (WhatsApp-like)
  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxH = 150; // ~6 lines
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
    ta.style.overflowY = ta.scrollHeight > maxH ? 'auto' : 'hidden';
    // Sync backdrop height
    if (backdropRef.current) {
      backdropRef.current.style.height = ta.style.height;
      backdropRef.current.style.overflowY = ta.style.overflowY;
    }
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [messageText, autoResizeTextarea]);

  // Sync scroll between textarea and backdrop
  const handleScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const onEmojiSelect = (emoji: any) => {
    setMessageText((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations, error: convError } = useQuery({
    queryKey: ['conversations', searchQuery, chatFilter, agentFilter, labelFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      // agentFilter takes precedence over chatFilter for assigned_to
      if (agentFilter) {
        params.set('assigned_to', agentFilter);
      } else if (chatFilter === 'mine' && user?.id) {
        params.set('assigned_to', user.id);
      } else if (chatFilter === 'unassigned') {
        params.set('assigned_to', 'unassigned');
      }
      if (labelFilter) params.set('label', labelFilter);
      const { data } = await api.get(`/conversations?${params}`);
      return (data.data || []) as Conversation[];
    },
    refetchOnMount: 'always',
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  // Fetch distinct labels for label filter dropdown
  const { data: availableLabels = [] } = useQuery({
    queryKey: ['conversation-labels'],
    queryFn: async () => {
      const { data } = await api.get('/conversations/labels');
      return (data.data || []) as { label: string; color: string | null }[];
    },
    staleTime: 30_000,
  });

  // Fetch active templates for slash-command quick reply
  const { data: slashTemplates = [] } = useQuery({
    queryKey: ['templates-active'],
    queryFn: async () => {
      const { data } = await api.get('/templates?is_active=true&limit=50');
      return (data.data || []) as { id: string; name: string; category: string | null; content: string; media_url: string | null; media_type: string | null }[];
    },
    staleTime: 60_000,
  });

  // Reset slash index when message text changes
  useEffect(() => { setSlashIndex(0); }, [messageText]);

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

  // Resolve conversation mutation
  const resolveMutation = useMutation({
    mutationFn: async (convId: string) => {
      await api.post(`/conversations/${convId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Percakapan ditutup');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Gagal menutup percakapan'),
  });

  // Check if user can assign (OWNER/ADMIN/SUPERVISOR)
  const canAssign = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  // Fetch team users for assign dialog
  const { data: teamUsers = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: async () => {
      const { data } = await api.get('/teams/users');
      return data.data || [];
    },
    enabled: canAssign,
  });

  // Assign conversation mutation
  const assignMutation = useMutation({
    mutationFn: async ({ convId, userId }: { convId: string; userId: string | null }) => {
      await api.post(`/conversations/${convId}/assign`, { user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setAssignDialogOpen(false);
      toast.success('Percakapan berhasil ditugaskan');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Gagal menugaskan'),
  });

  // Reopen conversation mutation
  const reopenMutation = useMutation({
    mutationFn: async (convId: string) => {
      await api.post(`/conversations/${convId}/reopen`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Percakapan dibuka kembali');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Gagal membuka percakapan'),
  });

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

  const deleteMutation = useMutation({
    mutationFn: async ({ messageId, deleteFor }: { messageId: string; deleteFor: 'everyone' | 'me' }) => {
      const { data } = await api.delete(`/conversations/${selectedId}/messages/${messageId}`, { data: { delete_for: deleteFor } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Pesan berhasil dihapus');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Gagal menghapus pesan');
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, newText }: { messageId: string; newText: string }) => {
      const { data } = await api.put(`/conversations/${selectedId}/messages/${messageId}`, { new_text: newText });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setEditingMessageId(null);
      setEditText('');
      toast.success('Pesan berhasil diedit');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Gagal mengedit pesan');
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

  // Slash command: derived values
  const slashActive = messageText.startsWith('/') && !attachedFile;
  const slashFilter = slashActive ? messageText.slice(1).toLowerCase() : '';
  const slashFiltered = slashActive
    ? slashTemplates.filter((t: any) =>
        t.name.toLowerCase().includes(slashFilter) ||
        (t.category || '').toLowerCase().includes(slashFilter)
      ).slice(0, 8)
    : [];

  const selectSlashTemplate = useCallback((tpl: { id: string; content: string }) => {
    let text = tpl.content;
    // Auto-substitute common variables with contact data
    if (selectedConv?.contact) {
      const contactName = selectedConv.contact.name || '';
      const contactPhone = selectedConv.contact.phone_number || '';
      text = text
        .replace(/\{\{name\}\}/gi, contactName)
        .replace(/\{\{nama\}\}/gi, contactName)
        .replace(/\{\{phone\}\}/gi, contactPhone);
    }
    setMessageText(text);
    // Record template usage (fire-and-forget)
    api.post(`/templates/${tpl.id}/use`).catch(() => {});
  }, [selectedConv]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command keyboard navigation
    if (slashActive && slashFiltered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashFiltered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashFiltered.length) % slashFiltered.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectSlashTemplate(slashFiltered[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMessageText('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // WhatsApp-style formatting shortcuts
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const ta = textareaRef.current;
      if (!ta) return;
      let prefix = '', suffix = '';
      if (e.key === 'b') { prefix = '*'; suffix = '*'; }
      else if (e.key === 'i') { prefix = '_'; suffix = '_'; }
      if (prefix) {
        e.preventDefault();
        const s = ta.selectionStart, end = ta.selectionEnd;
        const sel = messageText.substring(s, end);
        const wrapped = sel ? prefix + sel + suffix : prefix + suffix;
        const nv = messageText.substring(0, s) + wrapped + messageText.substring(end);
        setMessageText(nv);
        const cursor = sel ? s + wrapped.length : s + prefix.length;
        requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(cursor, cursor); });
      }
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
    // Include JWT token for authenticated media proxy
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    // If it's a full URL (http/https), proxy through CRM backend
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return `${API_BASE_URL}/media/wa-proxy?url=${encodeURIComponent(normalized)}${tokenParam}`;
    }
    // Relative path — also proxy (prepend WA API base if needed)
    return `${API_BASE_URL}/media/wa-proxy?url=${encodeURIComponent(normalized)}${tokenParam}`;
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
          {/* Filter tabs — hidden for AGENT (backend enforces own-chats-only) */}
          {!isAgent && (
            <div className="space-y-2 mt-2">
              <div className="flex gap-1">
                {([
                  { key: 'all', label: 'Semua' },
                  { key: 'mine', label: 'Chat Saya' },
                  { key: 'unassigned', label: 'Belum Ditugaskan' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={cn(
                      'flex-1 text-[11px] font-medium py-1.5 rounded-md transition-colors',
                      chatFilter === f.key && !agentFilter
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                    onClick={() => { setChatFilter(f.key); setAgentFilter(''); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Agent filter dropdown */}
              <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v === '__all__' ? '' : v); if (v && v !== '__all__') setChatFilter('all'); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filter by Agent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Agent</SelectItem>
                  {teamUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Label filter — all roles, sourced from /conversations/labels endpoint */}
          {availableLabels.length > 0 && (
            <div className="mt-2">
              <Select value={labelFilter || '__all__'} onValueChange={(v) => setLabelFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Filter by Label..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Label</SelectItem>
                  {availableLabels.map((l) => (
                    <SelectItem key={l.label} value={l.label}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canAssign && (
                      <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                        <UserCog className="h-4 w-4 mr-2" />
                        Tugaskan ke CS
                      </DropdownMenuItem>
                    )}
                    {selectedConv?.status === 'OPEN' ? (
                      <DropdownMenuItem onClick={() => selectedConv && resolveMutation.mutate(selectedConv.id)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Tutup Percakapan
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => selectedConv && reopenMutation.mutate(selectedConv.id)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Buka Kembali
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3 max-w-3xl mx-auto">
                {messages.filter((msg) => msg.content || msg.media_url || msg.message_type !== 'TEXT').map((msg) => {
                  const isOutgoing = msg.direction === 'OUTGOING';
                  const isDeleted = msg.status === 'DELETED';
                  const canEdit = isOutgoing && !isDeleted && !['AUDIO', 'STICKER'].includes(msg.message_type)
                    && (Date.now() - new Date(msg.created_at).getTime()) < 15 * 60 * 1000;
                  const isEditing = editingMessageId === msg.id;

                  return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex group',
                      isOutgoing ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {/* Action dropdown - appears on hover, before bubble for outgoing */}
                    {isOutgoing && !isDeleted && (
                      <div className="flex items-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-full hover:bg-muted/80 text-muted-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditText(msg.content || msg.caption || '');
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit pesan
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate({ messageId: msg.id, deleteFor: 'everyone' })}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus untuk semua
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate({ messageId: msg.id, deleteFor: 'me' })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus untuk saya
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                        isDeleted
                          ? 'bg-muted/50 border border-dashed border-muted-foreground/30'
                          : isOutgoing
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                      )}
                    >
                      {isDeleted ? (
                        <p className="italic text-muted-foreground flex items-center gap-1.5">
                          <Ban className="h-3.5 w-3.5" />
                          Pesan telah dihapus
                        </p>
                      ) : (
                        <>
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
                        isEditing ? (
                          <div className="flex flex-col gap-2 min-w-[240px]">
                            <textarea
                              className={cn(
                                'w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none',
                                'border-0 ring-0 shadow-none',
                                isOutgoing
                                  ? 'bg-primary-foreground/15 text-primary-foreground placeholder:text-primary-foreground/50'
                                  : 'bg-background/80 text-foreground placeholder:text-muted-foreground'
                              )}
                              style={{ overflow: 'hidden' }}
                              value={editText}
                              onChange={(e) => {
                                setEditText(e.target.value);
                                // Auto-resize
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                              }}
                              ref={(el) => {
                                if (el) {
                                  el.focus();
                                  el.style.height = 'auto';
                                  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
                                  // Place cursor at end
                                  el.selectionStart = el.selectionEnd = el.value.length;
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  if (editText.trim()) editMutation.mutate({ messageId: msg.id, newText: editText });
                                }
                                if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                  setEditText('');
                                }
                              }}
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => { setEditingMessageId(null); setEditText(''); }}
                                className={cn(
                                  'text-xs px-3 py-1 rounded-md font-medium transition-colors',
                                  isOutgoing
                                    ? 'text-primary-foreground/80 hover:bg-primary-foreground/15'
                                    : 'text-muted-foreground hover:bg-muted'
                                )}
                              >
                                Batal
                              </button>
                              <button
                                onClick={() => { if (editText.trim()) editMutation.mutate({ messageId: msg.id, newText: editText }); }}
                                disabled={editMutation.isPending || !editText.trim()}
                                className={cn(
                                  'text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-50',
                                  isOutgoing
                                    ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                )}
                              >
                                {editMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                              </button>
                            </div>
                          </div>
                        ) : (
                        <p className="whitespace-pre-wrap break-words">
                          {formatWAText(msg.content || msg.caption || `[${msg.message_type}]`)}
                        </p>
                        )
                      )}
                        </>
                      )}
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isOutgoing ? 'justify-end' : 'justify-start'
                      )}>
                        <span className={cn(
                          'text-[10px]',
                          isDeleted ? 'text-muted-foreground' : isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        {msg.is_edited && !isDeleted && (
                          <span className={cn(
                            'text-[10px] italic',
                            isOutgoing ? 'text-primary-foreground/50' : 'text-muted-foreground/70'
                          )}>diedit</span>
                        )}
                        {isOutgoing && !isDeleted && getStatusIcon(msg.status)}
                      </div>
                    </div>

                    {/* Delete dropdown - after bubble for incoming */}
                    {!isOutgoing && !isDeleted && (
                      <div className="flex items-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-full hover:bg-muted/80 text-muted-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate({ messageId: msg.id, deleteFor: 'me' })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus untuk saya
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  );
                })}
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
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 mb-0.5" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative rounded-md bg-muted/50">
                  {/* WhatsApp-style floating format toolbar */}
                  {showFormatBar && (
                    <div
                      ref={formatBarRef}
                      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 bg-zinc-800 rounded-lg px-1.5 py-1 shadow-lg"
                    >
                      {[
                        { type: 'bold' as const, icon: Bold, title: 'Bold (*teks*)' },
                        { type: 'italic' as const, icon: Italic, title: 'Italic (_teks_)' },
                        { type: 'strikethrough' as const, icon: Strikethrough, title: 'Coret (~teks~)' },
                        { type: 'code' as const, icon: Code, title: 'Monospace (`teks`)' },
                        { type: 'ordered' as const, icon: ListOrdered, title: 'Daftar Bernomor' },
                        { type: 'unordered' as const, icon: List, title: 'Daftar Bullet' },
                        { type: 'quote' as const, icon: Quote, title: 'Kutipan (> teks)' },
                      ].map((btn) => (
                        <button
                          key={btn.type}
                          type="button"
                          title={btn.title}
                          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-zinc-700 transition-colors text-zinc-200 hover:text-white"
                          onMouseDown={(e) => { e.preventDefault(); applyFormat(btn.type); }}
                        >
                          <btn.icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Formatted backdrop overlay (WYSIWYG preview) */}
                  <div
                    ref={backdropRef}
                    aria-hidden="true"
                    className="absolute inset-0 px-3 py-2 pr-10 text-sm leading-5 pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
                    style={{ minHeight: '38px', maxHeight: '150px' }}
                  >
                    {messageText ? formatWAText(messageText) : (
                      <span className="text-muted-foreground">Ketik pesan...</span>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    placeholder=""
                    className="flex w-full rounded-md border-0 px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-5"
                    style={{ minHeight: '38px', maxHeight: '150px', color: 'transparent', caretColor: 'currentColor', WebkitTextFillColor: 'transparent', background: 'transparent', position: 'relative', zIndex: 1 }}
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onSelect={handleTextSelect}
                    onMouseUp={handleTextSelect}
                    onScroll={handleScroll}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 bottom-1 h-7 w-7 z-[2]"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                  >
                    <Smile className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  {/* Slash command template popup */}
                  {slashActive && slashFiltered.length > 0 && (
                    <div ref={slashMenuRef} className="absolute bottom-12 left-0 z-50 w-full max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                      {slashFiltered.map((tpl: any, idx: number) => (
                        <button
                          key={tpl.id}
                          type="button"
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm transition-colors',
                            idx === slashIndex ? 'bg-primary/10' : 'hover:bg-muted'
                          )}
                          onMouseDown={(e) => { e.preventDefault(); selectSlashTemplate(tpl); }}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate text-xs">{tpl.name}</span>
                            {tpl.category && (
                              <Badge variant="outline" className="text-[10px] shrink-0">{tpl.category}</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5 pl-[22px]">{tpl.content.slice(0, 80)}{tpl.content.length > 80 ? '...' : ''}</p>
                        </button>
                      ))}
                      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground">
                        <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">↑↓</kbd> navigasi · <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Enter</kbd> pilih · <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Esc</kbd> tutup
                      </div>
                    </div>
                  )}
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-12 right-0 z-50">
                      <Picker data={data} onEmojiSelect={onEmojiSelect} theme="light" locale="id" previewPosition="none" skinTonePosition="none" />
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0 mb-0.5"
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
      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Tugaskan Percakapan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {/* Unassign option */}
            <button
              type="button"
              className={cn(
                'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted',
                !selectedConv?.assigned_to_user && 'border-primary bg-primary/5'
              )}
              onClick={() => selectedId && assignMutation.mutate({ convId: selectedId, userId: null })}
              disabled={assignMutation.isPending}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Tidak Ditugaskan</p>
                <p className="text-xs text-muted-foreground">Lepas dari semua CS</p>
              </div>
            </button>
            {/* User list */}
            {(teamUsers as any[]).filter((u: any) => u.is_active).map((u: any) => (
              <button
                key={u.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted',
                  selectedConv?.assigned_to_user?.id === u.id && 'border-primary bg-primary/5'
                )}
                onClick={() => selectedId && assignMutation.mutate({ convId: selectedId, userId: u.id })}
                disabled={assignMutation.isPending}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {u.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.role}</p>
                </div>
                <span className={cn('h-2 w-2 rounded-full shrink-0', u.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
