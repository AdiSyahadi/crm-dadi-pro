import { Router } from 'express';
import { exportController } from '../controllers/export.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard, authorize('OWNER', 'ADMIN', 'SUPERVISOR'));

router.get('/conversations', exportController.exportConversations);
router.get('/contacts', exportController.exportContacts);
router.get('/deals', exportController.exportDeals);

export default router;
