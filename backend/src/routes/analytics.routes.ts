import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

// Analytics restricted to OWNER, ADMIN, SUPERVISOR — AGENT should not see org-wide metrics
router.get('/dashboard', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), analyticsController.dashboard);
router.get('/messages/volume', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), analyticsController.messageVolume);
router.get('/agents/performance', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), analyticsController.agentPerformance);
router.get('/contacts/growth', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), analyticsController.contactGrowth);

export default router;
