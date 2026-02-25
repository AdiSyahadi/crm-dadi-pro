/**
 * Plan Limits Configuration
 * Single source of truth for all plan-based restrictions.
 * 
 * -1 means unlimited.
 */

export interface PlanLimits {
  // Resource quotas
  maxUsers: number;
  maxContacts: number;
  maxWaInstances: number;
  maxTemplates: number;
  maxBroadcastsPerMonth: number;
  maxRecipientsPerBroadcast: number;
  maxScheduledMessages: number;
  maxDeals: number;
  maxTags: number;
  maxWebhookConfigs: number;
  dailyMessageLimit: number;
  maxImportBatchSize: number;
  maxStorageMb: number;

  // Feature flags
  features: {
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
  };

  // Analytics data range (days)
  analyticsMaxDays: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE: {
    maxUsers: 1,
    maxContacts: 100,
    maxWaInstances: 1,
    maxTemplates: 5,
    maxBroadcastsPerMonth: 0,
    maxRecipientsPerBroadcast: 0,
    maxScheduledMessages: 0,
    maxDeals: 0,
    maxTags: 3,
    maxWebhookConfigs: 0,
    dailyMessageLimit: 50,
    maxImportBatchSize: 0,
    maxStorageMb: 100,
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
  },

  STARTER: {
    maxUsers: 3,
    maxContacts: 1_000,
    maxWaInstances: 2,
    maxTemplates: 20,
    maxBroadcastsPerMonth: 5,
    maxRecipientsPerBroadcast: 100,
    maxScheduledMessages: 0,
    maxDeals: 50,
    maxTags: 10,
    maxWebhookConfigs: 0,
    dailyMessageLimit: 500,
    maxImportBatchSize: 100,
    maxStorageMb: 1_024,
    features: {
      broadcast: true,
      scheduledMessages: false,
      deals: true,
      closingReport: false,
      autoResponseNewChat: true,
      autoResponseOutsideHours: false,
      webhookConfigs: false,
      webhookAutoReply: false,
      teamManagement: false,
      assignConversation: true,
      conversationLabels: true,
      conversationPriority: false,
      contactImport: true,
      contactCustomFields: false,
      editMessage: true,
      analyticsMessageVolume: true,
      analyticsAgentPerformance: false,
      analyticsContactGrowth: false,
      apiAccess: false,
      scheduleBroadcast: false,
      broadcastMedia: true,
    },
    analyticsMaxDays: 7,
  },

  PROFESSIONAL: {
    maxUsers: 10,
    maxContacts: 10_000,
    maxWaInstances: 5,
    maxTemplates: 100,
    maxBroadcastsPerMonth: 30,
    maxRecipientsPerBroadcast: 1_000,
    maxScheduledMessages: 5,
    maxDeals: -1,
    maxTags: -1,
    maxWebhookConfigs: 2,
    dailyMessageLimit: 2_000,
    maxImportBatchSize: 1_000,
    maxStorageMb: 5_120,
    features: {
      broadcast: true,
      scheduledMessages: true,
      deals: true,
      closingReport: true,
      autoResponseNewChat: true,
      autoResponseOutsideHours: true,
      webhookConfigs: true,
      webhookAutoReply: false,
      teamManagement: true,
      assignConversation: true,
      conversationLabels: true,
      conversationPriority: true,
      contactImport: true,
      contactCustomFields: true,
      editMessage: true,
      analyticsMessageVolume: true,
      analyticsAgentPerformance: true,
      analyticsContactGrowth: true,
      apiAccess: false,
      scheduleBroadcast: true,
      broadcastMedia: true,
    },
    analyticsMaxDays: 30,
  },

  ENTERPRISE: {
    maxUsers: -1,
    maxContacts: -1,
    maxWaInstances: -1,
    maxTemplates: -1,
    maxBroadcastsPerMonth: -1,
    maxRecipientsPerBroadcast: -1,
    maxScheduledMessages: -1,
    maxDeals: -1,
    maxTags: -1,
    maxWebhookConfigs: -1,
    dailyMessageLimit: -1,
    maxImportBatchSize: 1_000,
    maxStorageMb: 51_200,
    features: {
      broadcast: true,
      scheduledMessages: true,
      deals: true,
      closingReport: true,
      autoResponseNewChat: true,
      autoResponseOutsideHours: true,
      webhookConfigs: true,
      webhookAutoReply: true,
      teamManagement: true,
      assignConversation: true,
      conversationLabels: true,
      conversationPriority: true,
      contactImport: true,
      contactCustomFields: true,
      editMessage: true,
      analyticsMessageVolume: true,
      analyticsAgentPerformance: true,
      analyticsContactGrowth: true,
      apiAccess: true,
      scheduleBroadcast: true,
      broadcastMedia: true,
    },
    analyticsMaxDays: 90,
  },
};

/** Get plan limits with fallback to FREE (sync — uses hardcoded config only) */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS['FREE']!;
}

/**
 * Get plan limits from DB first, fallback to hardcoded config.
 * This is the preferred method for runtime enforcement.
 */
export async function getPlanLimitsAsync(plan: string): Promise<PlanLimits> {
  try {
    // Lazy import to avoid circular dependency
    const { prisma } = await import('./database');
    const dbPlan = await prisma.subscriptionPlan.findUnique({
      where: { plan_code: plan as any },
    });

    if (dbPlan) {
      const features = (typeof dbPlan.features === 'object' && dbPlan.features !== null)
        ? dbPlan.features as Record<string, boolean>
        : {};

      return {
        maxUsers: dbPlan.max_users,
        maxContacts: dbPlan.max_contacts,
        maxWaInstances: dbPlan.max_wa_instances,
        maxTemplates: dbPlan.max_templates,
        maxBroadcastsPerMonth: dbPlan.max_broadcasts_per_month,
        maxRecipientsPerBroadcast: dbPlan.max_recipients_per_broadcast,
        maxScheduledMessages: dbPlan.max_scheduled_messages,
        maxDeals: dbPlan.max_deals,
        maxTags: dbPlan.max_tags,
        maxWebhookConfigs: dbPlan.max_webhook_configs,
        dailyMessageLimit: dbPlan.daily_message_limit,
        maxImportBatchSize: dbPlan.max_import_batch_size,
        maxStorageMb: dbPlan.max_storage_mb,
        analyticsMaxDays: dbPlan.analytics_max_days,
        features: {
          broadcast: features.broadcast ?? false,
          scheduledMessages: features.scheduledMessages ?? false,
          deals: features.deals ?? false,
          closingReport: features.closingReport ?? false,
          autoResponseNewChat: features.autoResponseNewChat ?? false,
          autoResponseOutsideHours: features.autoResponseOutsideHours ?? false,
          webhookConfigs: features.webhookConfigs ?? false,
          webhookAutoReply: features.webhookAutoReply ?? false,
          teamManagement: features.teamManagement ?? false,
          assignConversation: features.assignConversation ?? false,
          conversationLabels: features.conversationLabels ?? false,
          conversationPriority: features.conversationPriority ?? false,
          contactImport: features.contactImport ?? false,
          contactCustomFields: features.contactCustomFields ?? false,
          editMessage: features.editMessage ?? false,
          analyticsMessageVolume: features.analyticsMessageVolume ?? false,
          analyticsAgentPerformance: features.analyticsAgentPerformance ?? false,
          analyticsContactGrowth: features.analyticsContactGrowth ?? false,
          apiAccess: features.apiAccess ?? false,
          scheduleBroadcast: features.scheduleBroadcast ?? false,
          broadcastMedia: features.broadcastMedia ?? false,
        },
      };
    }
  } catch {
    // DB not available — fall through to hardcoded
  }

  return PLAN_LIMITS[plan] || PLAN_LIMITS['FREE']!;
}

/** Check if a quota allows more (returns true if under limit or unlimited) */
export function isWithinQuota(current: number, max: number): boolean {
  return max === -1 || current < max;
}

/** Check if a feature is enabled for a plan */
export function isFeatureEnabled(plan: string, feature: keyof PlanLimits['features']): boolean {
  const limits = getPlanLimits(plan);
  return limits.features[feature];
}
