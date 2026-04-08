import { Router } from 'express';
import { savedFilterController } from '../controllers/saved-filter.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

// All authenticated users can manage their own filters
router.get('/', savedFilterController.list);
router.get('/:id', savedFilterController.getById);
router.post('/', savedFilterController.create);
router.patch('/:id', savedFilterController.update);
router.delete('/:id', savedFilterController.delete);
router.post('/:id/default', savedFilterController.setDefault);

export default router;
