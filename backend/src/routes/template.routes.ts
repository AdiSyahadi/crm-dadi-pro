import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', templateController.list);
router.get('/:id', templateController.getById);
router.post('/', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), templateController.create);
router.patch('/:id', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), templateController.update);
router.delete('/:id', authorize('OWNER', 'ADMIN'), templateController.delete);
router.post('/:id/toggle', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), templateController.toggleActive);
router.post('/:id/use', templateController.use);

export default router;
