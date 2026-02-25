'use client';

import { useAuthStore, type PlanFeatures, type PlanLimits } from '@/stores/auth.store';

/** Default limits applied when plan data isn't loaded yet (mirrors FREE plan) */
const FREE_DEFAULTS: PlanLimits = {
  maxUsers: 1,
  maxContacts: 100,
  maxWaInstances: 1,
  maxTemplates: 5,
  maxBroadcastsPerMonth: 0,
  maxRecipientsPerBroadcast: 0,
  maxScheduledMessages: 0,
  maxDeals: 0,
  maxTags: 5,
  maxWebhookConfigs: 0,
  dailyMessageLimit: 50,
  maxImportBatchSize: 0,
  maxStorageMb: 50,
  features: {
    broadcast: false,
    scheduledMessages: false,
    deals: false,
    closingReport: false,
    autoResponseNewChat: false,
    autoResponseOutsideHours: false,
    webhookConfigs: false,
    webhookAutoReply: false,
    teamManagement: false,
    assignConversation: false,
    conversationLabels: false,
    conversationPriority: false,
    contactImport: false,
    contactCustomFields: false,
    editMessage: false,
    analyticsMessageVolume: false,
    analyticsAgentPerformance: false,
    analyticsContactGrowth: false,
    apiAccess: false,
    scheduleBroadcast: false,
    broadcastMedia: false,
  },
  analyticsMaxDays: 7,
};

/**
 * Returns current org plan name and full plan limits.
 * Falls back to FREE defaults when data hasn't loaded.
 */
export function usePlan() {
  const user = useAuthStore((s) => s.user);
  const plan = user?.organization?.plan ?? 'FREE';
  const planLimits = user?.organization?.planLimits ?? FREE_DEFAULTS;
  return { plan, planLimits };
}

/**
 * Check if a specific feature is enabled on the current plan.
 */
export function useFeatureEnabled(feature: keyof PlanFeatures): boolean {
  const { planLimits } = usePlan();
  return planLimits.features[feature] ?? false;
}

/**
 * Returns true when the given quota max allows more items (-1 = unlimited).
 */
export function useQuotaRemaining(max: number, current: number): boolean {
  if (max === -1) return true;
  return current < max;
}
