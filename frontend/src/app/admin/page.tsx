'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, TrendingUp } from 'lucide-react';

interface DashboardStats {
  organizations: {
    total: number;
    active: number;
    trial: number;
    inactive: number;
  };
  users: {
    total: number;
  };
  planDistribution: { plan: string; count: number }[];
  revenue: {
    totalVerified: number;
    verifiedCount: number;
  };
  pendingPayments: number;
  recentInvoices: {
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
    created_at: string;
    organization: { name: string };
  }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Gagal memuat data dashboard.
      </div>
    );
  }

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const kpiCards = [
    { title: 'Total Organisasi', value: stats.organizations.total, icon: Building2, desc: `${stats.organizations.active} aktif, ${stats.organizations.trial} trial` },
    { title: 'Total User', value: stats.users.total, icon: Users, desc: 'Semua organisasi' },
    { title: 'Revenue', value: formatRupiah(stats.revenue.totalVerified), icon: TrendingUp, desc: `${stats.revenue.verifiedCount} invoice terverifikasi` },
    { title: 'Pending Payment', value: stats.pendingPayments, icon: CreditCard, desc: 'Menunggu verifikasi' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribusi Paket</CardTitle>
        </CardHeader>
        <CardContent>
          {(stats.planDistribution ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data.</p>
          ) : (
            <div className="space-y-3">
              {stats.planDistribution.map((item) => (
                <div key={item.plan} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.plan}</span>
                  <span className="text-sm text-muted-foreground">{item.count} organisasi</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {(stats.recentInvoices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada invoice.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">No. Invoice</th>
                    <th className="pb-2 font-medium">Organisasi</th>
                    <th className="pb-2 font-medium">Jumlah</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="py-2">{inv.organization?.name || '-'}</td>
                      <td className="py-2">{formatRupiah(inv.amount)}</td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'VERIFIED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          inv.status === 'PAID' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
