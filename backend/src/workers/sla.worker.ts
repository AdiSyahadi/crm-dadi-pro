import { slaService } from '../services/sla.service';

/**
 * SLA Breach Check Worker
 * Runs every 5 minutes to check for SLA warnings and breaches
 */
export function startSlaWorker(intervalMs = 5 * 60 * 1000) {
  // Run once on startup after a short delay
  setTimeout(() => runSlaCheck(), 15_000);

  // Then run periodically (default: every 5 minutes)
  const timer = setInterval(() => runSlaCheck(), intervalMs);

  console.log('✅ SLA worker started (breach check every 5 min)');
  return timer;
}

async function runSlaCheck() {
  try {
    await slaService.checkBreaches();
  } catch (err) {
    console.error('❌ SLA worker error:', err);
  }
}
