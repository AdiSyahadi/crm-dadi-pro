import { Request, Response, NextFunction } from 'express';
import { internalChatService } from '../services/internal-chat.service';
import { sendSuccess } from '../utils/api-response';

class InternalChatController {
  async listChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await internalChatService.listChats(req.user!.organizationId, req.user!.userId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async findOrCreateDM(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { target_user_id } = req.body;
      if (!target_user_id) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'target_user_id wajib diisi' } });
        return;
      }
      const data = await internalChatService.findOrCreateDM(req.user!.organizationId, req.user!.userId, target_user_id);
      sendSuccess(res, data, 'Chat berhasil dibuat', 201);
    } catch (error) {
      next(error);
    }
  }

  async createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, member_ids } = req.body;
      if (!name || !Array.isArray(member_ids)) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'name dan member_ids wajib diisi' } });
        return;
      }
      const data = await internalChatService.createGroup(req.user!.organizationId, req.user!.userId, name, member_ids);
      sendSuccess(res, data, 'Grup berhasil dibuat', 201);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const data = await internalChatService.getMessages(req.user!.organizationId, req.params.chatId as string, req.user!.userId, page, limit);
      sendSuccess(res, data.messages, undefined, 200, data.meta);
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content } = req.body;
      if (!content) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'content wajib diisi' } });
        return;
      }
      const data = await internalChatService.sendMessage(req.user!.organizationId, req.params.chatId as string, req.user!.userId, content);
      sendSuccess(res, data, undefined, 201);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await internalChatService.markRead(req.params.chatId as string, req.user!.userId);
      sendSuccess(res, null, 'Ditandai sudah dibaca');
    } catch (error) {
      next(error);
    }
  }
}

export const internalChatController = new InternalChatController();
