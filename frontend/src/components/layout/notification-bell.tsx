'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Check, MessageSquare, UserCog, Radio, AlertTriangle, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playNotificationSound, showBrowserNotification, requestNotificationPermission } from '@/lib/notification-utils';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  is_read: boolean;
  created_at: string;
}

const typeIcon: Record<string, typeof MessageSquare> = {
  NEW_MESSAGE: MessageSquare,
  ASSIGNED: UserCog,
  BROADCAST_COMPLETED: Megaphone,
  INSTANCE_DISCONNECTED: AlertTriangle,
  SYSTEM: Radio,
  MENTION: MessageSquare,
};

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?limit=20');
      return data.data;
    },
    refetchInterval: 60_000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      await api.post(`/notifications/${notifId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Request browser notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Listen for realtime notifications
  useEffect(() => {
    const socket = getSocket();
    const handleNewNotification = (notif: Notification) => {
      queryClient.setQueryData<{ notifications: Notification[]; unreadCount: number }>(
        ['notifications'],
        (old) => {
          if (!old) return { notifications: [notif], unreadCount: 1 };
          return {
            notifications: [notif, ...old.notifications].slice(0, 20),
            unreadCount: old.unreadCount + 1,
          };
        }
      );
      playNotificationSound();
      showBrowserNotification(notif.title, notif.body || undefined);
    };

    socket.on('notification:new', handleNewNotification);
    return () => { socket.off('notification:new', handleNewNotification); };
  }, [queryClient]);

  const handleClick = useCallback((notif: Notification) => {
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }
    // Navigate based on notification type
    if (notif.data?.conversation_id) {
      router.push(`/dashboard/chat?id=${notif.data.conversation_id}`);
      setOpen(false);
    }
  }, [markReadMutation, router]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifikasi</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1 px-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <Check className="h-3 w-3 mr-1" /> Tandai Semua Dibaca
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada notifikasi</p>
          ) : (
            <div>
              {notifications.map((notif) => {
                const Icon = typeIcon[notif.type] || Radio;
                return (
                  <button
                    key={notif.id}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                      !notif.is_read && 'bg-primary/5'
                    )}
                    onClick={() => handleClick(notif)}
                  >
                    <div className={cn(
                      'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                      !notif.is_read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-tight', !notif.is_read && 'font-medium')}>{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: localeId })}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
