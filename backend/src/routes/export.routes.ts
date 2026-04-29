import { Router } from 'express';
import { exportController } from '../controllers/export.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard, authorize('OWNER', 'ADMIN', 'SUPERVISOR'));

router.get('/conversations', exportController.exportConversations);
router.get('/contacts', exportController.exportContacts);
router.get('/deals', exportController.exportDeals);
router.get('/tasks', exportController.exportTasks);
router.get('/receipts', exportController.exportReceipts);
router.get('/broadcasts', exportController.exportBroadcasts);
router.get('/templates', exportController.exportTemplates);
router.get('/activity-logs', exportController.exportActivityLogs);
router.get('/scheduled-messages', exportController.exportScheduledMessages);
router.get('/appointments', exportController.exportAppointments);

export default router;
