import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', notificationController.list);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/:id/read', notificationController.markAsRead);

export default router;
