import { Router } from 'express';
import { webhookConfigController } from '../controllers/webhook-config.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

// Only OWNER and ADMIN can manage webhook configs
router.get('/', authorize('OWNER', 'ADMIN'), webhookConfigController.list.bind(webhookConfigController));
router.get('/:id', authorize('OWNER', 'ADMIN'), webhookConfigController.getById.bind(webhookConfigController));
router.post('/', authorize('OWNER', 'ADMIN'), webhookConfigController.create.bind(webhookConfigController));
router.patch('/:id', authorize('OWNER', 'ADMIN'), webhookConfigController.update.bind(webhookConfigController));
router.delete('/:id', authorize('OWNER', 'ADMIN'), webhookConfigController.delete.bind(webhookConfigController));
router.post('/:id/test', authorize('OWNER', 'ADMIN'), webhookConfigController.test.bind(webhookConfigController));

export default router;
