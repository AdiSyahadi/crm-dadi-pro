'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Key,
  Wallet,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface FlipConfigData {
  secret_key: string;
  secret_key_set: boolean;
  validation_token: string;
  validation_token_set: boolean;
  environment: string;
  is_enabled: boolean;
}

export function FlipConfigTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    secret_key: '',
    validation_token: '',
    environment: 'sandbox',
    is_enabled: false,
  });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showValidationToken, setShowValidationToken] = useState(false);

  const { data: config, isLoading } = useQuery<FlipConfigData>({
    queryKey: ['flip-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/flip');
      return data.data;
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        secret_key: '',
        validation_token: '',
        environment: config.environment || 'sandbox',
        is_enabled: config.is_enabled || false,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (input: typeof form) => {
      const payload: Record<string, string | boolean> = {
        environment: input.environment,
        is_enabled: input.is_enabled ? 'true' : 'false',
      };
      if (input.secret_key.trim()) {
        payload.secret_key = input.secret_key;
      }
      if (input.validation_token.trim()) {
        payload.validation_token = input.validation_token;
      }
      await api.put('/settings/flip', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flip-config'] });
      toast.success('Konfigurasi Flip berhasil disimpan');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Gagal menyimpan konfigurasi Flip');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Integrasi Flip
        </CardTitle>
        <CardDescription>
          Konfigurasi payment gateway Flip untuk pembayaran otomatis pada deal.
          Dapatkan kredensial dari{' '}
          <a href="https://flip.id" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            flip.id
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status indicator */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            {config?.is_enabled && config?.secret_key_set ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700">Flip Aktif</p>
                  <p className="text-xs text-muted-foreground">
                    Environment: <span className="font-medium">{config.environment}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                  <XCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700">Flip Belum Aktif</p>
                  <p className="text-xs text-muted-foreground">
                    {!config?.secret_key_set ? 'Secret Key belum diisi.' : 'Flip dinonaktifkan.'} Isi form di bawah untuk mengaktifkan.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Aktifkan Flip</Label>
            <p className="text-xs text-muted-foreground">Aktifkan pembayaran otomatis via Flip</p>
          </div>
          <Switch
            checked={form.is_enabled}
            onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
          />
        </div>

        {/* Secret Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Secret Key
          </Label>
          <div className="relative">
            <Input
              type={showSecretKey ? 'text' : 'password'}
              value={form.secret_key}
              onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
              placeholder={config?.secret_key_set ? 'Biarkan kosong jika tidak ingin mengubah' : 'Masukkan Secret Key...'}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowSecretKey(!showSecretKey)}
            >
              {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {config?.secret_key_set && (
            <p className="text-xs text-muted-foreground">Secret Key sudah diset: {config.secret_key}</p>
          )}
        </div>

        {/* Validation Token */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Validation Token
          </Label>
          <div className="relative">
            <Input
              type={showValidationToken ? 'text' : 'password'}
              value={form.validation_token}
              onChange={(e) => setForm({ ...form, validation_token: e.target.value })}
              placeholder={config?.validation_token_set ? 'Biarkan kosong jika tidak ingin mengubah' : 'Masukkan Validation Token...'}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowValidationToken(!showValidationToken)}
            >
              {showValidationToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {config?.validation_token_set && (
            <p className="text-xs text-muted-foreground">Validation Token sudah diset: {config.validation_token}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Token ini didapat dari dashboard Flip, digunakan untuk verifikasi callback.
          </p>
        </div>

        {/* Environment */}
        <div className="space-y-2">
          <Label>Environment</Label>
          <div className="flex gap-3">
            {(['sandbox', 'production'] as const).map((env) => (
              <Button
                key={env}
                variant={form.environment === env ? 'default' : 'outline'}
                size="sm"
                type="button"
                onClick={() => setForm({ ...form, environment: env })}
              >
                {env === 'sandbox' ? 'Sandbox (Testing)' : 'Production'}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Gunakan <span className="font-medium">Sandbox</span> untuk testing, <span className="font-medium">Production</span> untuk transaksi nyata.
          </p>
        </div>

        {/* Callback URL info */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            <strong>Callback URL:</strong> Masukkan URL berikut di dashboard Flip sebagai webhook/callback URL:
          </p>
          <code className="mt-1 block text-xs font-mono text-blue-800 bg-blue-100 rounded px-2 py-1">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/flip` : '/api/webhook/flip'}
          </code>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Konfigurasi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
