import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-6">Halaman tidak ditemukan</p>
      <Button asChild>
        <Link href="/dashboard">Kembali ke Dashboard</Link>
      </Button>
    </div>
  );
}
