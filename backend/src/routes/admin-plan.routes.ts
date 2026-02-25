import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/super-admin';
import { adminPlanController } from '../controllers/admin-plan.controller';

const router = Router();

// All routes require SUPER_ADMIN
router.use(authenticate, requireSuperAdmin);

router.get('/', (req, res, next) => adminPlanController.list(req, res, next));
router.get('/:id', (req, res, next) => adminPlanController.getById(req, res, next));
router.post('/', (req, res, next) => adminPlanController.create(req, res, next));
router.put('/:id', (req, res, next) => adminPlanController.update(req, res, next));
router.patch('/:id/toggle', (req, res, next) => adminPlanController.toggleActive(req, res, next));

export default router;
