'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageSquare, Send, Plus, Users, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playNotificationSound } from '@/lib/notification-utils';

interface InternalChat {
  id: string;
  name: string | null;
  is_group: boolean;
  unread_count: number;
  participants: { user_id: string; user: { id: string; name: string; avatar_url: string | null }; last_read_at: string | null }[];
  last_message: { content: string; created_at: string; sender_id: string } | null;
}

interface InternalMsg {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: { id: string; name: string; avatar_url: string | null };
}

export default function InternalChatPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [newDmOpen, setNewDmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chats
  const { data: chats = [] } = useQuery<InternalChat[]>({
    queryKey: ['internal-chats'],
    queryFn: async () => { const { data } = await api.get('/internal-chat'); return data.data; },
    refetchInterval: 15000,
  });

  // Fetch messages
  const { data: messagesData } = useQuery({
    queryKey: ['internal-messages', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return { data: [] };
      const { data } = await api.get(`/internal-chat/${selectedChatId}/messages?limit=100`);
      return data;
    },
    enabled: !!selectedChatId,
  });
  const messages: InternalMsg[] = messagesData?.data || [];

  // Fetch team users for new DM
  const { data: teamUsers = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: async () => { const { data } = await api.get('/teams/users'); return data.data; },
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/internal-chat/${selectedChatId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      setMessageText('');
    },
  });

  // Create DM mutation
  const createDmMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data } = await api.post('/internal-chat/dm', { target_user_id: targetUserId });
      return data.data;
    },
    onSuccess: (chat: any) => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      setSelectedChatId(chat.id);
      setNewDmOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message || 'Gagal membuat chat'),
  });

  // Socket.IO realtime — join all chat rooms for notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket || chats.length === 0) return;

    const chatIds = chats.map(c => c.id);
    chatIds.forEach(id => socket.emit('internal-chat:join', id));

    const handleMessage = (msg: InternalMsg) => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      if (msg.chat_id === selectedChatIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['internal-messages', selectedChatIdRef.current] });
      }
      // Play sound if message is from someone else
      if (msg.sender_id !== user?.id) {
        playNotificationSound();
        if (msg.chat_id !== selectedChatIdRef.current) {
          toast.info(`${msg.sender?.name || 'Seseorang'}: ${msg.content.substring(0, 60)}`);
        }
      }
    };
    socket.on('internal:message', handleMessage);

    return () => {
      chatIds.forEach(id => socket.emit('internal-chat:leave', id));
      socket.off('internal:message', handleMessage);
    };
  }, [chats, queryClient, user?.id]);

  // Keep ref in sync & mark as read when selecting a chat
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
    if (selectedChatId) {
      api.post(`/internal-chat/${selectedChatId}/read`).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
    }
  }, [selectedChatId, queryClient]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getChatDisplayName = (chat: InternalChat) => {
    if (chat.is_group) return chat.name || 'Grup';
    const other = chat.participants.find(p => p.user_id !== user?.id);
    return other?.user?.name || 'Chat';
  };

  const handleSend = () => {
    if (!messageText.trim() || !selectedChatId) return;
    sendMutation.mutate(messageText.trim());
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar — Chat list */}
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> Internal Chat
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewDmOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {chats.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Belum ada chat internal</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors',
                  selectedChatId === chat.id && 'bg-muted'
                )}
                onClick={() => setSelectedChatId(chat.id)}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {chat.is_group ? <Users className="h-4 w-4" /> : getChatDisplayName(chat).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium truncate', chat.unread_count > 0 && 'font-bold')}>{getChatDisplayName(chat)}</p>
                    {chat.last_message && (
                      <p className="text-[11px] text-muted-foreground truncate">{chat.last_message.content}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {chat.last_message && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(chat.last_message.created_at), 'HH:mm')}
                      </span>
                    )}
                    {chat.unread_count > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Pilih chat atau mulai percakapan baru</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 border-b flex items-center px-4 gap-2 bg-card">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px]">
                  {selectedChat.is_group ? <Users className="h-4 w-4" /> : getChatDisplayName(selectedChat).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{getChatDisplayName(selectedChat)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedChat.participants.length} peserta
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isSelf = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn('flex', isSelf ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[70%]', isSelf ? 'items-end' : 'items-start')}>
                        {!isSelf && (
                          <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.sender?.name}</p>
                        )}
                        <div className={cn(
                          'rounded-lg px-3 py-2 text-sm',
                          isSelf ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}>
                          {msg.content}
                        </div>
                        <p className={cn('text-[10px] text-muted-foreground mt-0.5', isSelf ? 'text-right mr-1' : 'ml-1')}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Tulis pesan..."
                className="flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <Button size="icon" disabled={!messageText.trim() || sendMutation.isPending} onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* New DM Dialog */}
      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Chat Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {teamUsers.filter((u: any) => u.id !== user?.id).map((u: any) => (
              <button
                key={u.id}
                type="button"
                className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors text-left"
                onClick={() => createDmMutation.mutate(u.id)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-[10px]">{(u.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground">{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
