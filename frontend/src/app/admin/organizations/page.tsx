'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Building2, Users, Power, Settings2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  subscription_plan: { name: string } | null;
  _count: { users: number; contacts: number; wa_instances: number };
}

interface OrgDetail extends Organization {
  users: { id: string; name: string; email: string; role: string }[];
  invoices: { id: string; invoice_number: string; amount: number; status: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PAST_DUE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const PLANS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
const SUB_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'];

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailOrg, setDetailOrg] = useState<OrgDetail | null>(null);
  const [changePlanOrg, setChangePlanOrg] = useState<Organization | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const limit = 20;

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (filterPlan !== 'all') params.plan = filterPlan;
    if (filterStatus !== 'all') params.status = filterStatus;

    api.get('/admin/organizations', { params })
      .then((res) => {
        setOrgs(res.data.data.organizations);
        setTotal(res.data.data.total);
      })
      .catch(() => toast.error('Gagal memuat data organisasi'))
      .finally(() => setLoading(false));
  }, [page, search, filterPlan, filterStatus]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const openDetail = async (org: Organization) => {
    try {
      const { data } = await api.get(`/admin/organizations/${org.id}`);
      setDetailOrg(data.data);
    } catch {
      toast.error('Gagal memuat detail organisasi');
    }
  };

  const handleToggleActive = async (org: Organization) => {
    try {
      await api.patch(`/admin/organizations/${org.id}/toggle-active`);
      toast.success(`Organisasi ${org.name} ${org.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchOrgs();
    } catch {
      toast.error('Gagal mengubah status organisasi');
    }
  };

  const handleChangePlan = async () => {
    if (!changePlanOrg || !newPlan) return;
    setSaving(true);
    try {
      await api.patch(`/admin/organizations/${changePlanOrg.id}/plan`, { planCode: newPlan });
      toast.success(`Plan ${changePlanOrg.name} diubah ke ${newPlan}`);
      setChangePlanOrg(null);
      setNewPlan('');
      fetchOrgs();
    } catch {
      toast.error('Gagal mengubah plan');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (orgId: string, status: string) => {
    try {
      await api.patch(`/admin/organizations/${orgId}/subscription-status`, { status });
      toast.success('Status langganan diperbarui');
      fetchOrgs();
    } catch {
      toast.error('Gagal mengubah status');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Organisasi</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Cari nama organisasi..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <Select value={filterPlan} onValueChange={(v) => { setFilterPlan(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semua Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Plan</SelectItem>
            {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semua Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {SUB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse bg-muted rounded" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Tidak ada organisasi ditemukan.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Organisasi</th>
                    <th className="p-3 font-medium">Plan</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-center">Users</th>
                    <th className="p-3 font-medium text-center">Kontak</th>
                    <th className="p-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium">{org.name}</p>
                            <p className="text-xs text-muted-foreground">{org.slug}</p>
                          </div>
                          {!org.is_active && <Badge variant="destructive" className="text-[10px]">Nonaktif</Badge>}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{org.plan}</Badge>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[org.subscription_status || 'TRIAL'] || ''}`}>
                          {org.subscription_status || 'TRIAL'}
                        </span>
                      </td>
                      <td className="p-3 text-center">{org._count?.users ?? 0}</td>
                      <td className="p-3 text-center">{org._count?.contacts ?? 0}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(org)} title="Detail">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setChangePlanOrg(org); setNewPlan(org.plan); }} title="Ubah Plan">
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(org)} title={org.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                            <Power className={`h-3.5 w-3.5 ${org.is_active ? 'text-green-600' : 'text-red-500'}`} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} organisasi total</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailOrg} onOpenChange={(open) => !open && setDetailOrg(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailOrg?.name}</DialogTitle>
          </DialogHeader>
          {detailOrg && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Slug:</span> {detailOrg.slug}</div>
                <div><span className="text-muted-foreground">Plan:</span> {detailOrg.plan}</div>
                <div><span className="text-muted-foreground">Status:</span> {detailOrg.subscription_status || 'TRIAL'}</div>
                <div><span className="text-muted-foreground">Aktif:</span> {detailOrg.is_active ? 'Ya' : 'Tidak'}</div>
                {detailOrg.subscription_expires_at && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Berakhir:</span>{' '}
                    {new Date(detailOrg.subscription_expires_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                  </div>
                )}
              </div>

              {/* Change subscription status */}
              <div>
                <Label className="text-xs">Ubah Status Langganan</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {SUB_STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={detailOrg.subscription_status === s ? 'default' : 'outline'}
                      className="text-xs h-7"
                      onClick={() => handleChangeStatus(detailOrg.id, s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Users */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Users ({detailOrg.users?.length ?? 0})</h4>
                {detailOrg.users?.length ? (
                  <div className="space-y-1">
                    {detailOrg.users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between text-sm border rounded p-2">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Tidak ada user.</p>
                )}
              </div>

              {/* Recent invoices */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Invoice Terbaru</h4>
                {detailOrg.invoices?.length ? (
                  <div className="space-y-1">
                    {detailOrg.invoices.slice(0, 5).map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm border rounded p-2">
                        <span className="font-mono text-xs">{inv.invoice_number}</span>
                        <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Belum ada invoice.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanOrg} onOpenChange={(open) => !open && setChangePlanOrg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Plan — {changePlanOrg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan saat ini: <strong>{changePlanOrg?.plan}</strong></Label>
            </div>
            <div>
              <Label>Plan baru</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setChangePlanOrg(null)}>Batal</Button>
              <Button onClick={handleChangePlan} disabled={saving || newPlan === changePlanOrg?.plan}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
