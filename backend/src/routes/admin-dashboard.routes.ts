import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/super-admin';
import { adminDashboardController } from '../controllers/admin-dashboard.controller';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/stats', (req, res, next) => adminDashboardController.getDashboard(req, res, next));

export default router;
