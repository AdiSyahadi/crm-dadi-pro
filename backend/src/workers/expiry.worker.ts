import { prisma } from '../config/database';

/**
 * Subscription & Invoice Expiry Worker
 * - Checks for expired subscriptions and downgrades orgs to FREE
 * - Checks for expired PENDING invoices and marks them as EXPIRED
 */
export function startExpiryWorker(intervalMs = 60 * 60 * 1000) {
  // Run once on startup after a short delay
  setTimeout(() => runExpiryChecks(), 10_000);

  // Then run periodically (default: every 1 hour)
  const timer = setInterval(() => runExpiryChecks(), intervalMs);

  console.log('✅ Expiry worker started (subscription + invoice)');
  return timer;
}

async function runExpiryChecks() {
  try {
    await checkSubscriptionExpiry();
    await checkInvoiceExpiry();
  } catch (err) {
    console.error('❌ Expiry worker error:', err);
  }
}

/** Downgrade orgs whose subscription has expired */
async function checkSubscriptionExpiry() {
  const now = new Date();

  const expiredOrgs = await prisma.organization.findMany({
    where: {
      subscription_status: 'ACTIVE',
      subscription_expires_at: { lt: now },
      plan: { not: 'FREE' },
    },
    select: { id: true, name: true, plan: true, subscription_expires_at: true },
  });

  if (expiredOrgs.length === 0) return;

  console.log(`🔄 Found ${expiredOrgs.length} expired subscriptions, downgrading...`);

  for (const org of expiredOrgs) {
    try {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          plan: 'FREE',
          subscription_plan_id: null,
          subscription_status: 'EXPIRED',
          // Keep subscription_expires_at for history
        },
      });
      console.log(`  ⬇️ ${org.name}: ${org.plan} → FREE (expired ${org.subscription_expires_at?.toISOString()})`);
    } catch (err) {
      console.error(`  ❌ Failed to downgrade org ${org.id}:`, err);
    }
  }
}

/** Mark PENDING invoices as EXPIRED if past their expired_at */
async function checkInvoiceExpiry() {
  const now = new Date();

  const result = await prisma.invoice.updateMany({
    where: {
      status: 'PENDING',
      expired_at: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  if (result.count > 0) {
    console.log(`📋 Expired ${result.count} pending invoices`);
  }
}
