import { Request, Response, NextFunction } from 'express';
import { chatbotService } from '../services/chatbot.service';
import { sendSuccess } from '../utils/api-response';

class ChatbotController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatbotService.list(req.user!.organizationId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatbotService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatbotService.create(req.user!.organizationId, req.body);
      sendSuccess(res, data, 'Chatbot flow berhasil dibuat', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatbotService.update(req.user!.organizationId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Chatbot flow berhasil diupdate');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await chatbotService.delete(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null, 'Chatbot flow berhasil dihapus');
    } catch (error) {
      next(error);
    }
  }

  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatbotService.toggle(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, data, data.is_active ? 'Chatbot diaktifkan' : 'Chatbot dinonaktifkan');
    } catch (error) {
      next(error);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatbotService.duplicate(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, data, 'Chatbot flow berhasil diduplikasi', 201);
    } catch (error) {
      next(error);
    }
  }
}

export const chatbotController = new ChatbotController();
