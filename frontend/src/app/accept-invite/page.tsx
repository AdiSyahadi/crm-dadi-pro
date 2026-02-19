'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const acceptMutation = useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await api.post('/auth/accept-invite', input);
      return data.data;
    },
    onSuccess: (data: any) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      toast.success('Akun berhasil diaktifkan! Selamat datang.');
      router.push('/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal mengaktifkan akun');
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link Tidak Valid</h2>
            <p className="text-sm text-muted-foreground text-center">
              Token undangan tidak ditemukan. Pastikan Anda menggunakan link yang benar dari admin.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => router.push('/login')}>
              Ke Halaman Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle>Aktifkan Akun Anda</CardTitle>
          <CardDescription>
            Anda telah diundang untuk bergabung. Silakan atur password untuk mengaktifkan akun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password !== confirmPassword) {
                toast.error('Konfirmasi password tidak cocok');
                return;
              }
              if (password.length < 8) {
                toast.error('Password minimal 8 karakter');
                return;
              }
              acceptMutation.mutate({ token, password });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Konfirmasi Password</Label>
              <Input
                type="password"
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aktifkan Akun
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
