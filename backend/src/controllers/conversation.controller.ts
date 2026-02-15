import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversation.service';
import { messageService } from '../services/message.service';
import { sendSuccess } from '../utils/api-response';

export class ConversationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await conversationService.list(req.user!.organizationId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        assigned_to: req.query.assigned_to as string | undefined,
        search: req.query.search as string | undefined,
        instance_id: req.query.instance_id as string | undefined,
      });
      sendSuccess(res, result.conversations, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversation = await conversationService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, conversation);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify conversation belongs to org
      await conversationService.getById(req.user!.organizationId, req.params.id as string);

      const result = await messageService.getByConversation(req.params.id as string, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      sendSuccess(res, result.messages, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, media_url, media_type, caption } = req.body;
      const conversationId = req.params.id as string;
      const userId = req.user!.userId;
      const orgId = req.user!.organizationId;

      let message;
      if (media_url) {
        message = await messageService.sendMedia(orgId, conversationId, media_url, caption, media_type || 'image', userId);
      } else {
        message = await messageService.sendText(orgId, conversationId, content, userId);
      }

      sendSuccess(res, message, 'Message sent');
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, team_id } = req.body;
      const conversation = await conversationService.assign(
        req.user!.organizationId,
        req.params.id as string,
        user_id,
        team_id,
        req.user!.userId
      );
      sendSuccess(res, conversation, 'Conversation assigned');
    } catch (error) {
      next(error);
    }
  }

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversation = await conversationService.resolve(
        req.user!.organizationId,
        req.params.id as string,
        req.user!.userId
      );
      sendSuccess(res, conversation, 'Conversation resolved');
    } catch (error) {
      next(error);
    }
  }

  async reopen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversation = await conversationService.reopen(
        req.user!.organizationId,
        req.params.id as string
      );
      sendSuccess(res, conversation, 'Conversation reopened');
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await conversationService.markAsRead(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();
