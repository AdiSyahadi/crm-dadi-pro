'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Power, Plus } from 'lucide-react';

interface PlanFeatures {
  broadcast: boolean;
  scheduledMessages: boolean;
  deals: boolean;
  closingReport: boolean;
  autoResponseNewChat: boolean;
  autoResponseOutsideHours: boolean;
  webhookConfigs: boolean;
  webhookAutoReply: boolean;
  teamManagement: boolean;
  assignConversation: boolean;
  conversationLabels: boolean;
  conversationPriority: boolean;
  contactImport: boolean;
  contactCustomFields: boolean;
  editMessage: boolean;
  analyticsMessageVolume: boolean;
  analyticsAgentPerformance: boolean;
  analyticsContactGrowth: boolean;
  apiAccess: boolean;
  scheduleBroadcast: boolean;
  broadcastMedia: boolean;
}

interface Plan {
  id: string;
  plan_code: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  max_users: number;
  max_contacts: number;
  max_wa_instances: number;
  max_templates: number;
  max_broadcasts_per_month: number;
  max_recipients_per_broadcast: number;
  max_scheduled_messages: number;
  max_deals: number;
  max_tags: number;
  max_webhook_configs: number;
  daily_message_limit: number;
  max_import_batch_size: number;
  max_storage_mb: number;
  analytics_max_days: number;
  features: PlanFeatures;
  is_active: boolean;
  sort_order: number;
  _count?: { subscribed_organizations: number; invoices: number };
}

const QUOTA_FIELDS: { key: string; label: string }[] = [
  { key: 'max_users', label: 'Max Users' },
  { key: 'max_contacts', label: 'Max Kontak' },
  { key: 'max_wa_instances', label: 'Max Instansi WA' },
  { key: 'max_templates', label: 'Max Template' },
  { key: 'max_broadcasts_per_month', label: 'Max Broadcast/Bulan' },
  { key: 'max_recipients_per_broadcast', label: 'Max Penerima/Broadcast' },
  { key: 'max_scheduled_messages', label: 'Max Pesan Terjadwal' },
  { key: 'max_deals', label: 'Max Deals' },
  { key: 'max_tags', label: 'Max Tags' },
  { key: 'max_webhook_configs', label: 'Max Webhook Config' },
  { key: 'daily_message_limit', label: 'Batas Pesan Harian' },
  { key: 'max_import_batch_size', label: 'Max Import Batch' },
  { key: 'max_storage_mb', label: 'Max Storage (MB)' },
  { key: 'analytics_max_days', label: 'Analytics Max Hari' },
];

const FEATURE_LABELS: Record<string, string> = {
  broadcast: 'Broadcast',
  scheduledMessages: 'Pesan Terjadwal',
  deals: 'Deals / Pipeline',
  closingReport: 'Closing Report',
  autoResponseNewChat: 'Auto-Response Chat Baru',
  autoResponseOutsideHours: 'Auto-Response Luar Jam',
  webhookConfigs: 'Webhook Config',
  webhookAutoReply: 'Webhook Auto-Reply',
  teamManagement: 'Manajemen Tim',
  assignConversation: 'Assign Conversation',
  conversationLabels: 'Label Percakapan',
  conversationPriority: 'Prioritas Percakapan',
  contactImport: 'Import Kontak',
  contactCustomFields: 'Custom Fields Kontak',
  editMessage: 'Edit Pesan',
  analyticsMessageVolume: 'Analytics Volume Pesan',
  analyticsAgentPerformance: 'Analytics Performa Agen',
  analyticsContactGrowth: 'Analytics Pertumbuhan Kontak',
  apiAccess: 'Akses API',
  scheduleBroadcast: 'Jadwal Broadcast',
  broadcastMedia: 'Broadcast Media',
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const DEFAULT_NEW_PLAN: Omit<Plan, 'id' | '_count'> = {
    plan_code: '',
    name: '',
    description: '',
    price: 0,
    billing_cycle: 'MONTHLY',
    max_users: 3,
    max_contacts: 500,
    max_wa_instances: 1,
    max_templates: 10,
    max_broadcasts_per_month: 5,
    max_recipients_per_broadcast: 100,
    max_scheduled_messages: 10,
    max_deals: 50,
    max_tags: 10,
    max_webhook_configs: 1,
    daily_message_limit: 100,
    max_import_batch_size: 100,
    max_storage_mb: 100,
    analytics_max_days: 7,
    features: {
      broadcast: false, scheduledMessages: false, deals: false, closingReport: false,
      autoResponseNewChat: false, autoResponseOutsideHours: false, webhookConfigs: false,
      webhookAutoReply: false, teamManagement: false, assignConversation: false,
      conversationLabels: false, conversationPriority: false, contactImport: false,
      contactCustomFields: false, editMessage: false, analyticsMessageVolume: false,
      analyticsAgentPerformance: false, analyticsContactGrowth: false, apiAccess: false,
      scheduleBroadcast: false, broadcastMedia: false,
    },
    is_active: true,
    sort_order: 0,
  };

  const fetchPlans = useCallback(() => {
    setLoading(true);
    api.get('/admin/plans')
      .then((res) => setPlans(res.data.data))
      .catch(() => toast.error('Gagal memuat data paket'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleToggle = async (plan: Plan) => {
    try {
      await api.patch(`/admin/plans/${plan.id}/toggle`);
      toast.success(`Paket ${plan.name} ${plan.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchPlans();
    } catch {
      toast.error('Gagal mengubah status paket');
    }
  };

  const handleSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      if (isCreating) {
        // CREATE
        const { id, _count, ...payload } = editPlan as Plan;
        await api.post('/admin/plans', payload);
        toast.success('Paket baru berhasil dibuat');
      } else {
        // UPDATE
        await api.put(`/admin/plans/${editPlan.id}`, {
        name: editPlan.name,
        description: editPlan.description,
        price: editPlan.price,
        billing_cycle: editPlan.billing_cycle,
        max_users: editPlan.max_users,
        max_contacts: editPlan.max_contacts,
        max_wa_instances: editPlan.max_wa_instances,
        max_templates: editPlan.max_templates,
        max_broadcasts_per_month: editPlan.max_broadcasts_per_month,
        max_recipients_per_broadcast: editPlan.max_recipients_per_broadcast,
        max_scheduled_messages: editPlan.max_scheduled_messages,
        max_deals: editPlan.max_deals,
        max_tags: editPlan.max_tags,
        max_webhook_configs: editPlan.max_webhook_configs,
        daily_message_limit: editPlan.daily_message_limit,
        max_import_batch_size: editPlan.max_import_batch_size,
        max_storage_mb: editPlan.max_storage_mb,
        analytics_max_days: editPlan.analytics_max_days,
        features: editPlan.features,
        sort_order: editPlan.sort_order,
      });
        toast.success('Paket berhasil diperbarui');
      }
      setEditPlan(null);
      setIsCreating(false);
      fetchPlans();
    } catch {
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const updateQuota = (key: string, value: string) => {
    if (!editPlan) return;
    setEditPlan({ ...editPlan, [key]: parseInt(value) || 0 });
  };

  const toggleFeature = (key: string) => {
    if (!editPlan) return;
    setEditPlan({
      ...editPlan,
      features: { ...editPlan.features, [key]: !editPlan.features[key as keyof PlanFeatures] },
    });
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Paket Langganan</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-24 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Paket Langganan</h2>
        <Button onClick={() => { setEditPlan({ ...DEFAULT_NEW_PLAN, id: '' } as Plan); setIsCreating(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Paket
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {plan.name}
                  <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                    {plan.plan_code}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditPlan({ ...plan })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggle(plan)}>
                  <Power className={`h-4 w-4 ${plan.is_active ? 'text-green-600' : 'text-red-500'}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatRupiah(plan.price)}<span className="text-sm font-normal text-muted-foreground">/{plan.billing_cycle}</span></div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{plan._count?.subscribed_organizations ?? 0} organisasi</span>
                <span>{plan._count?.invoices ?? 0} invoice</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(plan.features).filter(([, v]) => v).map(([k]) => (
                  <Badge key={k} variant="outline" className="text-[10px]">{FEATURE_LABELS[k] || k}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editPlan} onOpenChange={(open) => { if (!open) { setEditPlan(null); setIsCreating(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Tambah Paket Baru' : `Edit Paket — ${editPlan?.name}`}</DialogTitle>
          </DialogHeader>
          {editPlan && (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                {isCreating && (
                  <div>
                    <Label>Kode Paket</Label>
                    <Input value={editPlan.plan_code} onChange={(e) => setEditPlan({ ...editPlan, plan_code: e.target.value.toUpperCase() })} placeholder="STARTER" />
                  </div>
                )}
                <div>
                  <Label>Nama</Label>
                  <Input value={editPlan.name} onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })} />
                </div>
                <div>
                  <Label>Harga (Rp)</Label>
                  <Input type="number" value={editPlan.price} onChange={(e) => setEditPlan({ ...editPlan, price: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2">
                  <Label>Deskripsi</Label>
                  <Input value={editPlan.description || ''} onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })} />
                </div>
              </div>

              {/* Quotas */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Kuota Resource</h4>
                <p className="text-xs text-muted-foreground mb-3">Gunakan -1 untuk unlimited, 0 untuk disabled.</p>
                <div className="grid grid-cols-2 gap-3">
                  {QUOTA_FIELDS.map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        type="number"
                        value={(editPlan as unknown as Record<string, unknown>)[f.key] as number}
                        onChange={(e) => updateQuota(f.key, e.target.value)}
                        className="h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Fitur</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(editPlan.features).map((key) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border p-2">
                      <Label className="text-xs cursor-pointer" htmlFor={`feat-${key}`}>
                        {FEATURE_LABELS[key] || key}
                      </Label>
                      <Switch
                        id={`feat-${key}`}
                        checked={editPlan.features[key as keyof PlanFeatures]}
                        onCheckedChange={() => toggleFeature(key)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditPlan(null); setIsCreating(false); }}>Batal</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : isCreating ? 'Buat Paket' : 'Simpan'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
