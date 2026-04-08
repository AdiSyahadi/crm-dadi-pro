'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Search, User, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';

interface SearchContact {
  id: string;
  name: string;
  phone_number: string;
}

interface SearchConversation {
  id: string;
  contact: { id: string; name: string; phone_number: string };
  last_message_preview: string | null;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<SearchContact[]>([]);
  const [conversations, setConversations] = useState<SearchConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setContacts([]);
      setConversations([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [cRes, convRes] = await Promise.all([
          api.get(`/contacts?search=${encodeURIComponent(query)}&limit=5`),
          api.get(`/conversations?search=${encodeURIComponent(query)}&limit=5`),
        ]);
        setContacts(cRes.data.data || []);
        setConversations(convRes.data.data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((type: 'contact' | 'conversation', id: string) => {
    setOpen(false);
    setQuery('');
    if (type === 'contact') {
      router.push(`/dashboard/contacts/${id}`);
    } else {
      router.push(`/dashboard/chat?id=${id}`);
    }
  }, [router]);

  return (
    <>
      <div
        className="relative w-full cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari kontak, chat... (Ctrl+K)"
          className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 cursor-pointer"
          readOnly
        />
      </div>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Ketik untuk mencari..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!loading && query.length >= 2 && contacts.length === 0 && conversations.length === 0 && (
            <CommandEmpty>Tidak ada hasil untuk &quot;{query}&quot;</CommandEmpty>
          )}
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">Mencari...</div>
          )}
          {contacts.length > 0 && (
            <CommandGroup heading="Kontak">
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contact-${c.id}`}
                  onSelect={() => handleSelect('contact', c.id)}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.name || c.phone_number}</p>
                    {c.name && (
                      <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {conversations.length > 0 && (
            <CommandGroup heading="Percakapan">
              {conversations.map((conv) => (
                <CommandItem
                  key={conv.id}
                  value={`conv-${conv.id}`}
                  onSelect={() => handleSelect('conversation', conv.id)}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{conv.contact?.name || conv.contact?.phone_number}</p>
                    {conv.last_message_preview && (
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message_preview}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
