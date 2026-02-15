import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', conversationController.list);
router.get('/:id', conversationController.getById);
router.get('/:id/messages', conversationController.getMessages);
router.post('/:id/messages', conversationController.sendMessage);
router.post('/:id/assign', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), conversationController.assign);
router.post('/:id/resolve', conversationController.resolve);
router.post('/:id/reopen', conversationController.reopen);
router.post('/:id/read', conversationController.markAsRead);

export default router;
