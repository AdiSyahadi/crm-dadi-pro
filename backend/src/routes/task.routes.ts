import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', requireFeature('deals'), taskController.list);
router.get('/summary', requireFeature('deals'), taskController.summary);
router.get('/:id', requireFeature('deals'), taskController.getById);
router.post('/', requireFeature('deals'), taskController.create);
router.patch('/:id', requireFeature('deals'), taskController.update);
router.delete('/:id', requireFeature('deals'), taskController.delete);

export default router;
