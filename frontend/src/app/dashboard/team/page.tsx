'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useConfirmStore } from '@/stores/confirm.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, UsersRound, UserPlus, Loader2, Trash2, Shield, MoreVertical, KeyRound, UserX, UserCheck, ShieldCheck, Copy, Link2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const roleColors: Record<string, string> = {
  OWNER: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  SUPERVISOR: 'bg-blue-100 text-blue-700',
  AGENT: 'bg-emerald-100 text-emerald-700',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const openConfirm = useConfirmStore((s) => s.openConfirm);
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'AGENT' });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwTarget, setResetPwTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['team-users'],
    queryFn: async () => {
      const { data } = await api.get('/teams/users');
      return data.data;
    },
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data } = await api.get('/teams');
      return data.data;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (input: typeof inviteForm) => {
      const { data } = await api.post('/teams/users/invite', input);
      return data.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      if (data?.invite_token) {
        const baseUrl = window.location.origin;
        setInviteLink(`${baseUrl}/accept-invite?token=${data.invite_token}`);
        toast.success('Undangan berhasil dibuat. Salin link untuk dikirim ke anggota.');
      } else {
        setInviteOpen(false);
        setInviteLink(null);
        toast.success('User berhasil diundang');
      }
      setInviteForm({ name: '', email: '', role: 'AGENT' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal mengundang'),
  });

  const createTeamMutation = useMutation({
    mutationFn: async (input: typeof teamForm) => {
      await api.post('/teams', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setTeamOpen(false);
      setTeamForm({ name: '', description: '' });
      toast.success('Tim berhasil dibuat');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal membuat tim'),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      await api.patch(`/teams/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      toast.success('User berhasil diperbarui');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal memperbarui user'),
  });

  const resetPwMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      await api.post(`/teams/users/${userId}/reset-password`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      setResetPwOpen(false);
      setResetPwValue('');
      toast.success('Password berhasil direset');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Gagal reset password'),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Tim dihapus');
    },
  });

  const initials = (name: string) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tim & Anggota</h1>
        <p className="text-sm text-muted-foreground">Kelola anggota tim dan hak akses</p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Anggota</TabsTrigger>
          <TabsTrigger value="teams">Tim</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-end">
            {isAdmin && <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Undang Anggota
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Undang Anggota Baru</DialogTitle>
                </DialogHeader>
                {inviteLink ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 bg-emerald-50">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-700">Undangan Berhasil Dibuat</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Kirim link berikut ke anggota baru. Mereka akan mengatur password sendiri. Link berlaku 48 jam.
                      </p>
                      <div className="flex gap-2">
                        <Input value={inviteLink} readOnly className="text-xs bg-white" />
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteLink);
                            setLinkCopied(true);
                            toast.success('Link disalin!');
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                        >
                          {linkCopied ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => { setInviteLink(null); setInviteOpen(false); setLinkCopied(false); }}>
                      Tutup
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      inviteMutation.mutate(inviteForm);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Nama</Label>
                      <Input
                        placeholder="John Doe"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="john@perusahaan.com"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                          <SelectItem value="AGENT">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      Anggota akan menerima link untuk mengatur password sendiri.
                    </p>
                    <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Buat Undangan
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>}
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((user: any) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <span className={`h-2 w-2 rounded-full shrink-0 ${user.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Badge variant="secondary" className={cn('text-[10px] shrink-0', roleColors[user.role] || '')}>
                        {user.role}
                      </Badge>
                      {isAdmin && user.role !== 'OWNER' && user.id !== currentUserId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-xs" onClick={() => {
                              const roles = ['ADMIN', 'SUPERVISOR', 'AGENT'];
                              const currentIdx = roles.indexOf(user.role);
                              const nextRole = roles[(currentIdx + 1) % roles.length];
                              openConfirm({ title: `Ubah role ${user.name}?`, description: `Role akan diubah dari ${user.role} ke ${nextRole}.`, confirmText: 'Ya, Ubah', variant: 'default', onConfirm: () => updateUserMutation.mutate({ userId: user.id, data: { role: nextRole } }) });
                            }}>
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                              Ubah Role → {['ADMIN', 'SUPERVISOR', 'AGENT'][((['ADMIN', 'SUPERVISOR', 'AGENT'].indexOf(user.role)) + 1) % 3]}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => {
                              setResetPwTarget({ id: user.id, name: user.name });
                              setResetPwOpen(true);
                            }}>
                              <KeyRound className="h-3.5 w-3.5 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs" onClick={() => {
                              const action = user.is_active ? 'Nonaktifkan' : 'Aktifkan';
                              openConfirm({ title: `${action} akun ${user.name}?`, description: user.is_active ? 'User tidak bisa login setelah dinonaktifkan.' : 'User akan bisa login kembali.', confirmText: `Ya, ${action}`, variant: user.is_active ? 'destructive' : 'default', onConfirm: () => updateUserMutation.mutate({ userId: user.id, data: { is_active: !user.is_active } }) });
                            }}>
                              {user.is_active ? (
                                <><UserX className="h-3.5 w-3.5 mr-2 text-destructive" /><span className="text-destructive">Nonaktifkan</span></>
                              ) : (
                                <><UserCheck className="h-3.5 w-3.5 mr-2 text-emerald-600" /><span className="text-emerald-600">Aktifkan</span></>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span className={!user.is_active ? 'text-destructive' : ''}>{user.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </div>
                      {user.phone && (
                        <span className="text-xs text-muted-foreground">{user.phone}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-end">
            {isAdmin && <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Tim
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buat Tim Baru</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createTeamMutation.mutate(teamForm);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Nama Tim</Label>
                    <Input
                      placeholder="Tim Support"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Input
                      placeholder="Tim untuk menangani customer support"
                      value={teamForm.description}
                      onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createTeamMutation.isPending}>
                    {createTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Buat Tim
                  </Button>
                </form>
              </DialogContent>
            </Dialog>}
          </div>

          {loadingTeams ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UsersRound className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Belum ada tim</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team: any) => (
                <Card key={team.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold">{team.name}</h3>
                        {team.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>
                        )}
                      </div>
                      {isAdmin && <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          openConfirm({ title: 'Hapus tim ini?', description: 'Tim akan dihapus, anggota tidak akan terpengaruh.', onConfirm: () => deleteTeamMutation.mutate(team.id) });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {team.members?.length || 0} anggota
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {team._count?.assigned_conversations || 0} percakapan
                      </Badge>
                    </div>
                    {team.members?.length > 0 && (
                      <div className="flex -space-x-2 mt-3">
                        {team.members.slice(0, 5).map((m: any) => (
                          <Avatar key={m.user.id} className="h-7 w-7 border-2 border-card">
                            <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                              {initials(m.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {team.members.length > 5 && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-medium">
                            +{team.members.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={(open) => { setResetPwOpen(open); if (!open) setResetPwValue(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reset password untuk <strong>{resetPwTarget?.name}</strong>. User akan diminta login ulang.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (resetPwTarget) resetPwMutation.mutate({ userId: resetPwTarget.id, password: resetPwValue });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input
                type="password"
                placeholder="Minimal 8 karakter"
                value={resetPwValue}
                onChange={(e) => setResetPwValue(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={resetPwMutation.isPending}>
              {resetPwMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
