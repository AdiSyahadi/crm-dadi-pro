'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';

export function useUnreadChat() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data } = useQuery<number>({
    queryKey: ['chat-unread-total'],
    queryFn: async () => {
      const { data } = await api.get('/conversations/unread-total');
      return data.data.total as number;
    },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onMessage = (payload: any) => {
      const msg = payload?.message;
      if (msg?.direction === 'INCOMING') {
        queryClient.setQueryData<number>(['chat-unread-total'], (old) => (old ?? 0) + 1);
      }
    };

    const onRead = () => {
      // Refetch to get accurate count after a conversation is marked as read
      queryClient.invalidateQueries({ queryKey: ['chat-unread-total'] });
    };

    socket.on('chat:message', onMessage);
    socket.on('conversation:updated', onRead);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('conversation:updated', onRead);
    };
  }, [user, queryClient]);

  return data ?? 0;
}
