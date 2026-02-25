import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/wa-api', settingsController.getWaApiConfig.bind(settingsController));
router.put('/wa-api', settingsController.updateWaApiConfig.bind(settingsController));
router.post('/wa-api/test', settingsController.testWaApiConnection.bind(settingsController));
router.patch('/organization', settingsController.updateOrganization.bind(settingsController));

export default router;
