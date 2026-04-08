import { Router } from 'express';
import { internalChatController } from '../controllers/internal-chat.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', internalChatController.listChats);
router.post('/dm', internalChatController.findOrCreateDM);
router.post('/group', internalChatController.createGroup);
router.get('/:chatId/messages', internalChatController.getMessages);
router.post('/:chatId/messages', internalChatController.sendMessage);
router.post('/:chatId/read', internalChatController.markRead);

export default router;
