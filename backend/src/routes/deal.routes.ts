import { Router } from 'express';
import { dealController } from '../controllers/deal.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', dealController.list);
router.get('/pipeline', dealController.pipeline);
router.get('/report', dealController.closingReport);
router.get('/:id', dealController.getById);
router.post('/', dealController.create);
router.patch('/:id', dealController.update);
router.post('/:id/stage', dealController.moveStage);
router.post('/:id/won', dealController.markWon);
router.post('/:id/lost', dealController.markLost);
router.post('/:id/reopen', dealController.reopen);
router.post('/:id/notes', dealController.addNote);
router.delete('/:id', authorize('OWNER', 'ADMIN'), dealController.delete);

export default router;
