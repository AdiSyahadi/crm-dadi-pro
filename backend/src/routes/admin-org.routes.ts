import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/super-admin';
import { adminOrgController } from '../controllers/admin-org.controller';
import { prisma } from '../config/database';

const router = Router();

// All routes require SUPER_ADMIN
router.use(authenticate, requireSuperAdmin);

router.get('/', (req, res, next) => adminOrgController.list(req, res, next));
router.get('/:id', (req, res, next) => adminOrgController.getById(req, res, next));
router.patch('/:id/plan', (req, res, next) => adminOrgController.changePlan(req, res, next));
router.patch('/:id/toggle-active', (req, res, next) => adminOrgController.toggleActive(req, res, next));
router.patch('/:id/subscription-expiry', (req, res, next) => adminOrgController.setSubscriptionExpiry(req, res, next));
router.patch('/:id/subscription-status', (req, res, next) => adminOrgController.setSubscriptionStatus(req, res, next));

/**
 * POST /setup-admin-org
 * Creates a dedicated "System Admin" organization for SUPER_ADMIN users
 * and moves the requesting SUPER_ADMIN into it.
 * Idempotent — if org "system-admin" already exists, just moves user there.
 */
router.post('/setup-admin-org', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    // Find or create system admin org
    let adminOrg = await prisma.organization.findUnique({
      where: { slug: 'system-admin' },
    });

    if (!adminOrg) {
      adminOrg = await prisma.organization.create({
        data: {
          name: 'System Admin',
          slug: 'system-admin',
          plan: 'PROFESSIONAL',
          subscription_status: 'ACTIVE',
          max_users: 100,
          max_contacts: 999999,
          max_broadcasts_per_month: 999999,
        },
      });
    }

    // Move SUPER_ADMIN to admin org
    await prisma.user.update({
      where: { id: userId },
      data: { organization_id: adminOrg.id },
    });

    res.json({
      success: true,
      data: { organization_id: adminOrg.id, organization_name: adminOrg.name },
      message: 'SUPER_ADMIN berhasil dipindahkan ke organisasi System Admin. Silakan login ulang.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
