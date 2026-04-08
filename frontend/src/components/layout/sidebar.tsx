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
  Lock,
  Shield,
  CreditCard,
  Zap,
  Star,
  Timer,
  CalendarDays,
  Bot,
  MessageCircle,
  Receipt,
  ClipboardCheck,
  TrendingUp,
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
import { type PlanFeatures } from '@/stores/auth.store';
import { usePlan } from '@/hooks/use-plan';
import { Badge } from '@/components/ui/badge';
import { useUnreadChat } from '@/hooks/use-unread-chat';

const ALL_ROLES = ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as const;
const MANAGEMENT = ['OWNER', 'ADMIN', 'SUPERVISOR'] as const;
const ADMIN_UP = ['OWNER', 'ADMIN'] as const;

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  roles: readonly string[];
  /** If set, nav item is only visible when this feature is enabled */
  requiredFeature?: keyof PlanFeatures;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL_ROLES },
  { label: 'Chat', href: '/dashboard/chat', icon: MessageSquare, badge: true, roles: ALL_ROLES },
  { label: 'Kontak', href: '/dashboard/contacts', icon: Users, roles: ALL_ROLES },
  { label: 'Deals', href: '/dashboard/deals', icon: Handshake, roles: ALL_ROLES, requiredFeature: 'deals' },
  { label: 'Kwitansi', href: '/dashboard/receipts', icon: Receipt, roles: ALL_ROLES, requiredFeature: 'deals' },
  { label: 'Tugas', href: '/dashboard/tasks', icon: ClipboardCheck, roles: ALL_ROLES, requiredFeature: 'deals' },
  { label: 'Broadcast', href: '/dashboard/broadcasts', icon: Send, roles: MANAGEMENT, requiredFeature: 'broadcast' },
  { label: 'Jadwal Pesan', href: '/dashboard/scheduled-messages', icon: CalendarClock, roles: MANAGEMENT, requiredFeature: 'scheduledMessages' },
  { label: 'Template', href: '/dashboard/templates', icon: FileText, roles: ALL_ROLES },
  { label: 'Quick Reply', href: '/dashboard/quick-replies', icon: Zap, roles: ALL_ROLES },
  { label: 'Instansi WA', href: '/dashboard/instances', icon: Wifi, roles: ADMIN_UP },
  { label: 'Analitik', href: '/dashboard/analytics', icon: BarChart3, roles: MANAGEMENT },
  { label: 'Forecasting', href: '/dashboard/forecasting', icon: TrendingUp, roles: MANAGEMENT, requiredFeature: 'deals' as keyof PlanFeatures },
  { label: 'CSAT', href: '/dashboard/csat', icon: Star, roles: MANAGEMENT },
  { label: 'SLA', href: '/dashboard/sla', icon: Timer, roles: MANAGEMENT },
  { label: 'Hari Libur', href: '/dashboard/holidays', icon: CalendarDays, roles: ADMIN_UP },
  { label: 'Chatbot', href: '/dashboard/chatbot', icon: Bot, roles: ADMIN_UP },
  { label: 'Internal Chat', href: '/dashboard/internal-chat', icon: MessageCircle, roles: ALL_ROLES },
  { label: 'Tim', href: '/dashboard/team', icon: UsersRound, roles: MANAGEMENT },
  { label: 'Pengaturan', href: '/dashboard/settings', icon: Settings, roles: ADMIN_UP },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard, roles: ['OWNER'] as const },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { planLimits } = usePlan();
  const chatUnread = useUnreadChat();

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  /** Check if a nav item should be shown and whether it's locked */
  const getNavState = (item: NavItem) => {
    // SUPER_ADMIN sees everything, no locks
    if (user?.role === 'SUPER_ADMIN') {
      return { visible: true, locked: false };
    }
    // Role check
    if (user?.role && !(item.roles as readonly string[]).includes(user.role)) {
      return { visible: false, locked: false };
    }
    // Feature check
    if (item.requiredFeature && !planLimits.features[item.requiredFeature]) {
      return { visible: true, locked: true };
    }
    return { visible: true, locked: false };
  };

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
                Power WA
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
            {navItems.map((item) => {
              const { visible, locked } = getNavState(item);
              if (!visible) return null;

              const isActive = !locked && (
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
              );

              const linkContent = locked ? (
                <div
                  key={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-not-allowed opacity-50',
                    'text-muted-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                  title={`Upgrade paket untuk mengakses ${item.label}`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">PRO</Badge>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && chatUnread > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && item.badge && chatUnread > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                  )}
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

        {/* Super Admin link */}
        {user?.role === 'SUPER_ADMIN' && (
          <>
            <Separator />
            <div className="px-2 py-2">
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/admin"
                      className="flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors dark:text-red-400"
                    >
                      <Shield className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Panel Admin</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors dark:text-red-400"
                >
                  <Shield className="h-5 w-5" />
                  <span>Panel Admin</span>
                </Link>
              )}
            </div>
          </>
        )}

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
