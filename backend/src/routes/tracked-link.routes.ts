import { Router } from 'express';
import { trackedLinkController } from '../controllers/tracked-link.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', requireFeature('deals'), trackedLinkController.list);
router.get('/:id', requireFeature('deals'), trackedLinkController.getById);
router.post('/', requireFeature('deals'), trackedLinkController.create);
router.patch('/:id', requireFeature('deals'), trackedLinkController.update);
router.delete('/:id', requireFeature('deals'), trackedLinkController.delete);

export default router;
