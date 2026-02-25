import { Router } from 'express';
import { autoResponseController } from '../controllers/auto-response.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', autoResponseController.list);
router.put('/', authorize('OWNER', 'ADMIN'), requireFeature('autoResponseNewChat'), autoResponseController.upsert);
router.delete('/:trigger', authorize('OWNER', 'ADMIN'), autoResponseController.delete);

export default router;
