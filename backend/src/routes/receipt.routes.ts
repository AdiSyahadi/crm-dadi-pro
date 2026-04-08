import { Router } from 'express';
import { receiptController } from '../controllers/receipt.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireFeature } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/summary', requireFeature('deals'), receiptController.summary);
router.get('/config', requireFeature('deals'), receiptController.getConfig);
router.put('/config', authorize('OWNER', 'ADMIN'), receiptController.updateConfig);
router.get('/', requireFeature('deals'), receiptController.list);
router.get('/:id', requireFeature('deals'), receiptController.getById);
router.post('/', requireFeature('deals'), receiptController.create);
router.patch('/:id', requireFeature('deals'), receiptController.update);
router.post('/:id/void', requireFeature('deals'), receiptController.void);
router.post('/:id/send', requireFeature('deals'), receiptController.sendViaWA);
router.delete('/:id', authorize('OWNER', 'ADMIN'), receiptController.delete);

export default router;
