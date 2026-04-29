import { Router } from 'express';
import { activityLogController } from '../controllers/activity-log.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', activityLogController.list);

export default router;
