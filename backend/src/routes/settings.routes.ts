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
router.get('/notification-preferences', settingsController.getNotificationPreferences.bind(settingsController));
router.put('/notification-preferences', settingsController.updateNotificationPreferences.bind(settingsController));
router.get('/rotten-deals', settingsController.getRottenDealSettings.bind(settingsController));
router.put('/rotten-deals', settingsController.updateRottenDealSettings.bind(settingsController));

router.get('/midtrans', settingsController.getMidtransConfig.bind(settingsController));
router.put('/midtrans', settingsController.saveMidtransConfig.bind(settingsController));
router.post('/midtrans/test', settingsController.testMidtransConnection.bind(settingsController));

router.get('/flip', settingsController.getFlipConfig.bind(settingsController));
router.put('/flip', settingsController.saveFlipConfig.bind(settingsController));

export default router;
