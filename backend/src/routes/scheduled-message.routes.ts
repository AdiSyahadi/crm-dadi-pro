import { Router } from 'express';
import { scheduledMessageController } from '../controllers/scheduled-message.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature, checkQuota } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', scheduledMessageController.list);
router.get('/:id', scheduledMessageController.getById);
router.post('/', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), requireFeature('scheduledMessages'), checkQuota('scheduled_messages'), scheduledMessageController.create);
router.patch('/:id', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), scheduledMessageController.update);
router.post('/:id/toggle', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), scheduledMessageController.toggle);
router.delete('/:id', authorize('OWNER', 'ADMIN'), scheduledMessageController.delete);
router.post('/:id/recipients', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), scheduledMessageController.addRecipients);
router.delete('/:id/recipients', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), scheduledMessageController.removeRecipients);
router.get('/:id/logs', scheduledMessageController.getLogs);

export default router;
