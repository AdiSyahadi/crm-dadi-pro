import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/api-response';

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const offset = Number(req.query.offset) || 0;
      const result = await notificationService.list(req.user!.userId, limit, offset);
      sendSuccess(res, { notifications: result.notifications, unreadCount: result.unreadCount });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAsRead(req.user!.userId, req.params.id as string);
      sendSuccess(res, null, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.user!.userId);
      sendSuccess(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
