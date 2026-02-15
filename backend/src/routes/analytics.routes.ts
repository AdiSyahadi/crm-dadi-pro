import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/dashboard', analyticsController.dashboard);
router.get('/messages/volume', analyticsController.messageVolume);
router.get('/agents/performance', analyticsController.agentPerformance);
router.get('/contacts/growth', analyticsController.contactGrowth);

export default router;
