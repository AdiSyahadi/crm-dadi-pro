import { Request, Response, NextFunction } from 'express';
import { teamService } from '../services/team.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class TeamController {
  async listTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teams = await teamService.list(req.user!.organizationId);
      sendSuccess(res, teams);
    } catch (error) {
      next(error);
    }
  }

  async getTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const team = await teamService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, team);
    } catch (error) {
      next(error);
    }
  }

  async createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const team = await teamService.create(req.user!.organizationId, req.body);
      sendCreated(res, team, 'Team created');
    } catch (error) {
      next(error);
    }
  }

  async updateTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const team = await teamService.update(req.user!.organizationId, req.params.id as string, req.body);
      sendSuccess(res, team, 'Team updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await teamService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, is_leader } = req.body;
      const member = await teamService.addMember(req.user!.organizationId, req.params.id as string, user_id, is_leader);
      sendCreated(res, member, 'Member added');
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await teamService.removeMember(req.user!.organizationId, req.params.id as string, req.params.userId as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await teamService.listUsers(req.user!.organizationId);
      sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  }

  async inviteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await teamService.inviteUser(req.user!.organizationId, req.body);
      sendCreated(res, user, 'User invited');
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await teamService.updateUser(req.user!.organizationId, req.params.userId as string, req.body, req.user!.userId);
      sendSuccess(res, user, 'User updated');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password } = req.body;
      await teamService.resetPassword(req.user!.organizationId, req.params.userId as string, password);
      sendSuccess(res, null, 'Password berhasil direset');
    } catch (error) {
      next(error);
    }
  }
}

export const teamController = new TeamController();
