import { Router } from 'express';
import { holidayController } from '../controllers/holiday.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

router.get('/', holidayController.list);
router.post('/', authorize('OWNER', 'ADMIN'), holidayController.create);
router.patch('/:id', authorize('OWNER', 'ADMIN'), holidayController.update);
router.delete('/:id', authorize('OWNER', 'ADMIN'), holidayController.delete);

export default router;
