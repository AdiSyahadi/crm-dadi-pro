'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw, MessageSquare, Info, CheckCircle2, CreditCard } from 'lucide-react';

/* ─── Shared placeholder config ─── */
const UPGRADE_PLACEHOLDERS = [
  { key: '{name}', desc: 'Nama pemilik organisasi' },
  { key: '{plan_name}', desc: 'Nama paket yang dipilih' },
  { key: '{amount}', desc: 'Total tagihan (format Rupiah)' },
  { key: '{invoice_number}', desc: 'Nomor invoice' },
  { key: '{expired_at}', desc: 'Batas waktu pembayaran' },
  { key: '{bank_accounts}', desc: 'Daftar rekening bank aktif' },
];

const VERIFIED_PLACEHOLDERS = [
  { key: '{name}', desc: 'Nama pemilik organisasi' },
  { key: '{plan_name}', desc: 'Nama paket yang aktif' },
  { key: '{amount}', desc: 'Total yang dibayar (format Rupiah)' },
  { key: '{invoice_number}', desc: 'Nomor invoice' },
  { key: '{period_end}', desc: 'Masa berlaku paket sampai' },
];

/* ─── Reusable template editor card ─── */
function TemplateEditor({
  label,
  description,
  icon: Icon,
  enabled,
  onEnabledChange,
  template,
  onTemplateChange,
  placeholders,
  previewMessage,
  hasChanges,
  saving,
  onSave,
  onReset,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  template: string;
  onTemplateChange: (v: string) => void;
  placeholders: { key: string; desc: string }[];
  previewMessage: string;
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          </div>
        </CardHeader>
      </Card>

      {/* Template Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Template Pesan
          </CardTitle>
          <CardDescription>
            Tulis template pesan WA. Gunakan placeholder di bawah untuk data dinamis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Placeholder Reference */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">Placeholder yang tersedia:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {placeholders.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{p.key}</Badge>
                  <span className="text-muted-foreground">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-2">
            <Label>Isi Template</Label>
            <Textarea
              value={template}
              onChange={(e) => onTemplateChange(e.target.value)}
              rows={16}
              className="font-mono text-sm"
              placeholder="Tulis template pesan WA di sini..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button onClick={onSave} disabled={saving || !hasChanges}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan Template
            </Button>
            <Button variant="outline" onClick={onReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            {hasChanges && (
              <span className="text-sm text-amber-600">Ada perubahan belum disimpan</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview Pesan</CardTitle>
          <CardDescription>
            Contoh pesan yang akan dikirim (data placeholder diganti contoh)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-[#e5ddd5] p-4">
            <div className="max-w-md ml-auto">
              <div className="rounded-lg bg-[#dcf8c6] p-3 shadow-sm">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                  {previewMessage}
                </pre>
                <div className="text-right mt-1">
                  <span className="text-[10px] text-gray-500">12:00</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Main page ─── */
export default function AdminFollowUpTemplatePage() {
  // Upgrade template state
  const [upEnabled, setUpEnabled] = useState(true);
  const [upTemplate, setUpTemplate] = useState('');
  const [upOrigTemplate, setUpOrigTemplate] = useState('');
  const [upOrigEnabled, setUpOrigEnabled] = useState(true);

  // Verified template state
  const [verEnabled, setVerEnabled] = useState(true);
  const [verTemplate, setVerTemplate] = useState('');
  const [verOrigTemplate, setVerOrigTemplate] = useState('');
  const [verOrigEnabled, setVerOrigEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [savingUp, setSavingUp] = useState(false);
  const [savingVer, setSavingVer] = useState(false);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/payment-settings/followup-template'),
      api.get('/payment-settings/verified-template'),
    ])
      .then(([upRes, verRes]) => {
        const up = upRes.data.data;
        setUpEnabled(up.enabled);
        setUpTemplate(up.template);
        setUpOrigEnabled(up.enabled);
        setUpOrigTemplate(up.template);

        const ver = verRes.data.data;
        setVerEnabled(ver.enabled);
        setVerTemplate(ver.template);
        setVerOrigEnabled(ver.enabled);
        setVerOrigTemplate(ver.template);
      })
      .catch(() => toast.error('Gagal memuat template'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Save upgrade template
  const handleSaveUp = async () => {
    setSavingUp(true);
    try {
      const res = await api.put('/payment-settings/followup-template', { enabled: upEnabled, template: upTemplate });
      const d = res.data.data;
      setUpEnabled(d.enabled); setUpTemplate(d.template);
      setUpOrigEnabled(d.enabled); setUpOrigTemplate(d.template);
      toast.success('Template follow-up upgrade berhasil disimpan');
    } catch { toast.error('Gagal menyimpan template'); }
    finally { setSavingUp(false); }
  };

  // Save verified template
  const handleSaveVer = async () => {
    setSavingVer(true);
    try {
      const res = await api.put('/payment-settings/verified-template', { enabled: verEnabled, template: verTemplate });
      const d = res.data.data;
      setVerEnabled(d.enabled); setVerTemplate(d.template);
      setVerOrigEnabled(d.enabled); setVerOrigTemplate(d.template);
      toast.success('Template verifikasi berhasil disimpan');
    } catch { toast.error('Gagal menyimpan template'); }
    finally { setSavingVer(false); }
  };

  const upHasChanges = upTemplate !== upOrigTemplate || upEnabled !== upOrigEnabled;
  const verHasChanges = verTemplate !== verOrigTemplate || verEnabled !== verOrigEnabled;

  // Preview helpers
  const upPreview = upTemplate
    .replace(/\{name\}/g, 'Ahmad Fauzi')
    .replace(/\{plan_name\}/g, 'Professional')
    .replace(/\{amount\}/g, 'Rp499.000')
    .replace(/\{invoice_number\}/g, 'INV-20260225-AB12')
    .replace(/\{expired_at\}/g, '28 Februari 2026')
    .replace(/\{bank_accounts\}/g, '\ud83c\udfe6 *Rekening Pembayaran:*\n\n  \ud83c\udfe6 BCA\n  No. Rek: 1234567890\n  a.n. PT Power WA');

  const verPreview = verTemplate
    .replace(/\{name\}/g, 'Ahmad Fauzi')
    .replace(/\{plan_name\}/g, 'Professional')
    .replace(/\{amount\}/g, 'Rp499.000')
    .replace(/\{invoice_number\}/g, 'INV-20260225-AB12')
    .replace(/\{period_end\}/g, '25 Maret 2026');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Template WA Otomatis</h1>
        <p className="text-muted-foreground mt-1">
          Atur pesan WhatsApp otomatis yang dikirim ke pelanggan pada saat upgrade dan verifikasi pembayaran
        </p>
      </div>

      <Tabs defaultValue="upgrade" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="upgrade" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Follow-Up Upgrade
          </TabsTrigger>
          <TabsTrigger value="verified" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Verifikasi Bayar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upgrade">
          <TemplateEditor
            label="Auto Follow-Up Upgrade"
            description="Pesan WA otomatis dikirim setelah pelanggan memilih paket dan membuat invoice"
            icon={MessageSquare}
            enabled={upEnabled}
            onEnabledChange={setUpEnabled}
            template={upTemplate}
            onTemplateChange={setUpTemplate}
            placeholders={UPGRADE_PLACEHOLDERS}
            previewMessage={upPreview}
            hasChanges={upHasChanges}
            saving={savingUp}
            onSave={handleSaveUp}
            onReset={() => { setUpEnabled(upOrigEnabled); setUpTemplate(upOrigTemplate); }}
          />
        </TabsContent>

        <TabsContent value="verified">
          <TemplateEditor
            label="Auto Follow-Up Verifikasi"
            description="Pesan WA otomatis dikirim setelah admin memverifikasi pembayaran"
            icon={CheckCircle2}
            enabled={verEnabled}
            onEnabledChange={setVerEnabled}
            template={verTemplate}
            onTemplateChange={setVerTemplate}
            placeholders={VERIFIED_PLACEHOLDERS}
            previewMessage={verPreview}
            hasChanges={verHasChanges}
            saving={savingVer}
            onSave={handleSaveVer}
            onReset={() => { setVerEnabled(verOrigEnabled); setVerTemplate(verOrigTemplate); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
