'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import {
  LayoutDashboard,
  CreditCard,
  Building2,
  Package,
  LogOut,
  ChevronLeft,
  Shield,
  MessageSquare,
  Settings,
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

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Paket Langganan', href: '/admin/plans', icon: Package },
  { label: 'Organisasi', href: '/admin/organizations', icon: Building2 },
  { label: 'Invoice', href: '/admin/invoices', icon: CreditCard },
  { label: 'Pengaturan Bayar', href: '/admin/payment-settings', icon: Settings },
  { label: 'Template WA', href: '/admin/followup-template', icon: MessageSquare },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'SA';

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
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                Admin
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/admin" className="mx-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                <Shield className="h-4 w-4 text-white" />
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

        {/* Back to CRM link */}
        <div className="px-2 pt-3 pb-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Kembali ke CRM</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Kembali ke CRM</span>
            </Link>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);

              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-red-600 dark:text-red-400')} />
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

              return <div key={item.href}>{linkContent}</div>;
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* User */}
        <div className={cn('p-3', collapsed && 'flex flex-col items-center')}>
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col')}>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-red-500/10 text-red-600 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">Super Admin</p>
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
