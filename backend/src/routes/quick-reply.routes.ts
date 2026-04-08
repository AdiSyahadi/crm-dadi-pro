import { Router } from 'express';
import { quickReplyController } from '../controllers/quick-reply.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.use(authenticate, tenantGuard);

// All agents can list and search quick replies
router.get('/', quickReplyController.list);
router.get('/search', quickReplyController.search);
router.get('/:id', quickReplyController.getById);

// Only OWNER/ADMIN/SUPERVISOR can manage
router.post('/', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), quickReplyController.create);
router.patch('/:id', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), quickReplyController.update);
router.delete('/:id', authorize('OWNER', 'ADMIN'), quickReplyController.delete);

// Any agent can record usage
router.post('/:id/use', quickReplyController.incrementUsage);

export default router;
