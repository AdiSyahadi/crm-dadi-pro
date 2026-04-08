import { Router } from 'express';
import { chatbotController } from '../controllers/chatbot.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard, authorize('OWNER', 'ADMIN'));

router.get('/', chatbotController.list);
router.get('/:id', chatbotController.getById);
router.post('/', chatbotController.create);
router.patch('/:id', chatbotController.update);
router.delete('/:id', chatbotController.delete);
router.post('/:id/toggle', chatbotController.toggle);
router.post('/:id/duplicate', chatbotController.duplicate);

export default router;
