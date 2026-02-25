import { Router } from 'express';
import { teamController } from '../controllers/team.controller';
import { authenticate, authorize } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { checkQuota, requireFeature } from '../middleware/plan-guard';

const router = Router();

router.use(authenticate, tenantGuard);

// Users management
router.get('/users', teamController.listUsers);
router.post('/users/invite', authorize('OWNER', 'ADMIN'), checkQuota('users'), teamController.inviteUser);
router.patch('/users/:userId', authorize('OWNER', 'ADMIN'), teamController.updateUser);
router.post('/users/:userId/reset-password', authorize('OWNER', 'ADMIN'), teamController.resetPassword);

// Teams (requires teamManagement feature)
router.get('/', teamController.listTeams);
router.get('/:id', teamController.getTeam);
router.post('/', authorize('OWNER', 'ADMIN'), requireFeature('teamManagement'), teamController.createTeam);
router.patch('/:id', authorize('OWNER', 'ADMIN'), teamController.updateTeam);
router.delete('/:id', authorize('OWNER', 'ADMIN'), teamController.deleteTeam);

// Team members
router.post('/:id/members', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), requireFeature('teamManagement'), teamController.addMember);
router.delete('/:id/members/:userId', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), teamController.removeMember);

export default router;
