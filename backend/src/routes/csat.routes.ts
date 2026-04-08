import { Router } from 'express';
import { csatController } from '../controllers/csat.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

// Settings (ADMIN+)
router.get('/settings', authorize('OWNER', 'ADMIN'), csatController.getSettings);
router.put('/settings', authorize('OWNER', 'ADMIN'), csatController.updateSettings);

// Analytics (MANAGEMENT)
router.get('/analytics', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), csatController.getAnalytics);
router.get('/responses', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), csatController.listResponses);

// Record response (internal — called when customer replies with rating)
router.post('/responses', csatController.recordResponse);

export default router;
