import { Router } from 'express';
import { contactController } from '../controllers/contact.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

// All contact routes require authentication + tenant check
router.use(authenticate, tenantGuard);

router.get('/', contactController.list);
router.get('/:id', contactController.getById);
router.post('/', contactController.create);
router.patch('/:id', contactController.update);
router.delete('/:id', authorize('OWNER', 'ADMIN'), contactController.delete);
router.post('/import', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), contactController.importContacts);

export default router;
