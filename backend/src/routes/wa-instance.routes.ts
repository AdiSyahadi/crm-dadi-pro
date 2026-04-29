import { Router } from 'express';
import { waInstanceController } from '../controllers/wa-instance.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { checkQuota } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', waInstanceController.list);
router.get('/remote', waInstanceController.fetchRemote);
router.get('/:id', waInstanceController.getById);
router.post('/', authorize('OWNER', 'ADMIN'), checkQuota('wa_instances'), waInstanceController.create);
router.patch('/:id', authorize('OWNER', 'ADMIN'), waInstanceController.update);
router.delete('/:id', authorize('OWNER', 'ADMIN'), waInstanceController.delete);
router.get('/:id/status', waInstanceController.getStatus);
router.get('/:id/qr', waInstanceController.getQR);
router.post('/:id/sync', authorize('OWNER', 'ADMIN'), waInstanceController.syncMessages);
router.post('/:id/reconnect', authorize('OWNER', 'ADMIN'), waInstanceController.reconnect);

export default router;
