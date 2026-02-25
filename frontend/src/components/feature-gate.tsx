'use client';

import { type ReactNode } from 'react';
import { type PlanFeatures } from '@/stores/auth.store';
import { useFeatureEnabled, usePlan } from '@/hooks/use-plan';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeatureGateProps {
  /** The feature flag to check */
  feature: keyof PlanFeatures;
  /** Content shown when feature is enabled */
  children: ReactNode;
  /** Custom fallback when feature is disabled. Defaults to an upgrade prompt. */
  fallback?: ReactNode;
  /** If true, hides content entirely instead of showing fallback */
  hide?: boolean;
}

/**
 * Conditionally renders children based on plan feature availability.
 *
 * Usage:
 *   <FeatureGate feature="broadcast">
 *     <BroadcastPage />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback, hide }: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature);

  if (enabled) return <>{children}</>;
  if (hide) return null;
  if (fallback) return <>{fallback}</>;

  return <UpgradePrompt feature={feature} />;
}

/* ---------- default fallback ---------- */

const FEATURE_LABELS: Record<string, string> = {
  broadcast: 'Broadcast',
  scheduledMessages: 'Jadwal Pesan',
  deals: 'Deals / Pipeline',
  closingReport: 'Laporan Closing',
  autoResponseNewChat: 'Auto-Response Chat Baru',
  autoResponseOutsideHours: 'Auto-Response Luar Jam Kerja',
  webhookConfigs: 'Webhook',
  teamManagement: 'Manajemen Tim',
  assignConversation: 'Assign Percakapan',
  editMessage: 'Edit Pesan',
  analyticsMessageVolume: 'Analitik Volume Pesan',
  analyticsAgentPerformance: 'Analitik Performa Agen',
  analyticsContactGrowth: 'Analitik Pertumbuhan Kontak',
  contactImport: 'Import Kontak',
  contactCustomFields: 'Custom Field Kontak',
  apiAccess: 'API Access',
  scheduleBroadcast: 'Jadwal Broadcast',
  broadcastMedia: 'Media Broadcast',
};

function UpgradePrompt({ feature }: { feature: string }) {
  const { plan } = usePlan();
  const label = FEATURE_LABELS[feature] ?? feature;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Fitur {label} Terkunci</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Fitur <strong>{label}</strong> tidak tersedia di paket{' '}
          <Badge variant="outline" className="mx-1">{plan}</Badge>.
          Upgrade paket Anda untuk mengakses fitur ini.
        </p>
      </div>
    </div>
  );
}
