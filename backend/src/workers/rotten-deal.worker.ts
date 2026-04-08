import { prisma } from '../config/database';
import { notificationService } from '../services/notification.service';
import { getIO } from '../socket/io';

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const DEFAULT_ROTTEN_DAYS = 7;

async function processRottenDeals() {
  try {
    // Get all active organizations
    const orgs = await prisma.organization.findMany({
      where: { is_active: true },
      select: { id: true, settings: true },
    });

    for (const org of orgs) {
      const settings = (org.settings as Record<string, any>) || {};
      const rottenDays = settings.rotten_deal_days ?? DEFAULT_ROTTEN_DAYS;

      if (rottenDays <= 0) continue; // disabled

      const cutoff = new Date(Date.now() - rottenDays * 24 * 60 * 60 * 1000);

      // Find open deals not updated since cutoff, not yet notified (or notified before cutoff)
      const rottenDeals = await prisma.deal.findMany({
        where: {
          organization_id: org.id,
          stage: { in: ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING'] },
          updated_at: { lt: cutoff },
          OR: [
            { rotten_notified_at: null },
            { rotten_notified_at: { lt: cutoff } },
          ],
        },
        select: {
          id: true,
          title: true,
          deal_number: true,
          stage: true,
          value: true,
          assigned_to_id: true,
          updated_at: true,
        },
        take: 50, // limit per org per cycle
      });

      if (rottenDeals.length === 0) continue;

      const io = getIO();

      for (const deal of rottenDeals) {
        const daysSince = Math.floor((Date.now() - deal.updated_at.getTime()) / (1000 * 60 * 60 * 24));

        // Notify assigned user or all org admins
        const notifyUserIds: string[] = [];
        if (deal.assigned_to_id) {
          notifyUserIds.push(deal.assigned_to_id);
        } else {
          const admins = await prisma.user.findMany({
            where: { organization_id: org.id, role: { in: ['OWNER', 'ADMIN'] }, is_active: true },
            select: { id: true },
          });
          notifyUserIds.push(...admins.map((a) => a.id));
        }

        for (const userId of notifyUserIds) {
          await notificationService.create(
            userId,
            'DEAL_ROTTEN',
            `Deal "${deal.title}" tidak aktif ${daysSince} hari`,
            `Deal #${deal.deal_number} (${deal.stage}) belum ada update selama ${daysSince} hari. Segera follow up!`,
            { deal_id: deal.id }
          );

          if (io) {
            io.to(`user:${userId}`).emit('deal:rotten', {
              deal_id: deal.id,
              title: deal.title,
              days_inactive: daysSince,
            });
          }
        }

        // Mark as notified
        await prisma.deal.update({
          where: { id: deal.id },
          data: { rotten_notified_at: new Date() },
        });
      }

      if (rottenDeals.length > 0) {
        console.log(`⚠️ Found ${rottenDeals.length} rotten deals in org ${org.id}`);
      }
    }
  } catch (err) {
    console.error('Rotten deal worker error:', err);
  }
}

export function startRottenDealWorker() {
  setTimeout(() => {
    processRottenDeals();
    setInterval(processRottenDeals, CHECK_INTERVAL);
  }, 30_000); // 30s startup delay

  console.log('✅ Rotten deal worker started (check every 1 hour)');
}
