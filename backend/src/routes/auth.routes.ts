import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/accept-invite', authController.acceptInvite);
router.post('/change-password', authenticate, tenantGuard, authController.changePassword);
router.get('/profile', authenticate, tenantGuard, authController.getProfile);
router.patch('/profile', authenticate, tenantGuard, authController.updateProfile);

export default router;
