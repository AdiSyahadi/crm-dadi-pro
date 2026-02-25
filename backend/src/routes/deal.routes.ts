import { Router } from 'express';
import { dealController } from '../controllers/deal.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature, checkQuota } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', requireFeature('deals'), dealController.list);
router.get('/pipeline', requireFeature('deals'), dealController.pipeline);
router.get('/report', requireFeature('closingReport'), dealController.closingReport);
router.get('/:id', requireFeature('deals'), dealController.getById);
router.post('/', requireFeature('deals'), checkQuota('deals'), dealController.create);
router.patch('/:id', requireFeature('deals'), dealController.update);
router.post('/:id/stage', requireFeature('deals'), dealController.moveStage);
router.post('/:id/won', requireFeature('deals'), dealController.markWon);
router.post('/:id/lost', requireFeature('deals'), dealController.markLost);
router.post('/:id/reopen', requireFeature('deals'), dealController.reopen);
router.post('/:id/notes', requireFeature('deals'), dealController.addNote);
router.delete('/:id', authorize('OWNER', 'ADMIN'), dealController.delete);

export default router;
