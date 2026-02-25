import { Router } from 'express';
import { broadcastController } from '../controllers/broadcast.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature, checkQuota } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', broadcastController.list);
router.get('/:id', broadcastController.getById);
router.post('/', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), requireFeature('broadcast'), checkQuota('broadcasts_monthly'), broadcastController.create);
router.post('/:id/start', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), requireFeature('broadcast'), broadcastController.start);
router.post('/:id/pause', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), broadcastController.pause);
router.post('/:id/cancel', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), broadcastController.cancel);
router.delete('/:id', authorize('OWNER', 'ADMIN'), broadcastController.delete);

export default router;
