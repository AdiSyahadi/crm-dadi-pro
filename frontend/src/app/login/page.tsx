'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Login berhasil!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#687EFF] via-[#80B3FF] to-[#98E4FF] items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <MessageSquare className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold">CRM-DADI</h1>
          </div>
          <h2 className="text-2xl font-semibold mb-4">
            WhatsApp CRM Platform
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Kelola kontak, percakapan, deals, dan broadcast WhatsApp dalam satu platform terintegrasi.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
              <p className="text-2xl font-bold">Multi-Agent</p>
              <p className="text-sm text-white/70">Tim support kolaboratif</p>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
              <p className="text-2xl font-bold">Realtime</p>
              <p className="text-sm text-white/70">Chat & notifikasi live</p>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
              <p className="text-2xl font-bold">Pipeline</p>
              <p className="text-sm text-white/70">Deal & closing tracker</p>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
              <p className="text-2xl font-bold">Broadcast</p>
              <p className="text-sm text-white/70">Pesan massal anti-ban</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <MessageSquare className="h-7 w-7 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Masuk ke akun</CardTitle>
            <CardDescription>Masukkan email dan password untuk melanjutkan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Masuk'
                )}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Belum punya akun?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Daftar sekarang
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
