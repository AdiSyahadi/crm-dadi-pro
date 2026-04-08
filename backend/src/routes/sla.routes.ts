import { Router } from 'express';
import { slaController } from '../controllers/sla.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

// Settings (ADMIN+)
router.get('/settings', authorize('OWNER', 'ADMIN'), slaController.getSettings);
router.put('/settings', authorize('OWNER', 'ADMIN'), slaController.updateSettings);

// Stats (MANAGEMENT)
router.get('/stats', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), slaController.getStats);

export default router;
