import { Router } from 'express';
import { webhookConfigController } from '../controllers/webhook-config.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature, checkQuota } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

// Only OWNER and ADMIN can manage webhook configs
router.get('/', authorize('OWNER', 'ADMIN'), requireFeature('webhookConfigs'), webhookConfigController.list.bind(webhookConfigController));
router.get('/:id', authorize('OWNER', 'ADMIN'), requireFeature('webhookConfigs'), webhookConfigController.getById.bind(webhookConfigController));
router.post('/', authorize('OWNER', 'ADMIN'), requireFeature('webhookConfigs'), checkQuota('webhook_configs'), webhookConfigController.create.bind(webhookConfigController));
router.patch('/:id', authorize('OWNER', 'ADMIN'), requireFeature('webhookConfigs'), webhookConfigController.update.bind(webhookConfigController));
router.delete('/:id', authorize('OWNER', 'ADMIN'), webhookConfigController.delete.bind(webhookConfigController));
router.post('/:id/test', authorize('OWNER', 'ADMIN'), requireFeature('webhookConfigs'), webhookConfigController.test.bind(webhookConfigController));

export default router;
