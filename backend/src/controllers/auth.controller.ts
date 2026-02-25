import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';
import { sendSuccess, sendCreated } from '../utils/api-response';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.register(input, ipAddress);
      sendCreated(res, result, 'Registration successful');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const deviceInfo = req.headers['user-agent'];
      const result = await authService.login(input, ipAddress, deviceInfo);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.refreshToken(refreshToken, ipAddress);
      sendSuccess(res, result, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      await authService.logout(refreshToken);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.acceptInvite(token, password, ipAddress);
      sendSuccess(res, result, 'Akun berhasil diaktifkan');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { oldPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.userId, oldPassword, newPassword);
      sendSuccess(res, null, 'Password berhasil diubah');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await authService.getProfile(userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, phone } = req.body;
      const result = await authService.updateProfile(userId, { name, phone });
      sendSuccess(res, result, 'Profil berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
