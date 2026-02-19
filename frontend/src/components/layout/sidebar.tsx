'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Handshake,
  Send,
  CalendarClock,
  FileText,
  BarChart3,
  UsersRound,
  Settings,
  LogOut,
  ChevronLeft,
  Wifi,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ALL_ROLES = ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as const;
const MANAGEMENT = ['OWNER', 'ADMIN', 'SUPERVISOR'] as const;
const ADMIN_UP = ['OWNER', 'ADMIN'] as const;

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL_ROLES },
  { label: 'Chat', href: '/dashboard/chat', icon: MessageSquare, badge: true, roles: ALL_ROLES },
  { label: 'Kontak', href: '/dashboard/contacts', icon: Users, roles: ALL_ROLES },
  { label: 'Deals', href: '/dashboard/deals', icon: Handshake, roles: ALL_ROLES },
  { label: 'Broadcast', href: '/dashboard/broadcasts', icon: Send, roles: MANAGEMENT },
  { label: 'Jadwal Pesan', href: '/dashboard/scheduled-messages', icon: CalendarClock, roles: MANAGEMENT },
  { label: 'Template', href: '/dashboard/templates', icon: FileText, roles: ALL_ROLES },
  { label: 'Instansi WA', href: '/dashboard/instances', icon: Wifi, roles: ADMIN_UP },
  { label: 'Analitik', href: '/dashboard/analytics', icon: BarChart3, roles: MANAGEMENT },
  { label: 'Tim', href: '/dashboard/team', icon: UsersRound, roles: MANAGEMENT },
  { label: 'Pengaturan', href: '/dashboard/settings', icon: Settings, roles: ADMIN_UP },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col border-r bg-card transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[250px]'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-[#687EFF] to-[#80B3FF] bg-clip-text text-transparent">
                CRM-DADI
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
            </Link>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-1 px-2">
            {navItems.filter((item) => !user?.role || (item.roles as readonly string[]).includes(user.role)).map((item) => {
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* User */}
        <div className={cn('p-3', collapsed && 'flex flex-col items-center')}>
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col')}>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
              </div>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => logout()}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Logout</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
