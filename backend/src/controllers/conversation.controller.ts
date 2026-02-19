import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversation.service';
import { messageService } from '../services/message.service';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

/**
 * AGENT role guard: verify the conversation is assigned to this agent.
 * OWNER/ADMIN/SUPERVISOR can access any conversation in their org.
 * Standalone function so `this` binding is not required.
 */
function verifyAgentAccess(req: Request, conversation: any): void {
  if (req.user!.role === 'AGENT' && conversation.assigned_to_user_id !== req.user!.userId) {
    throw AppError.forbidden('Agents can only access conversations assigned to them');
  }
}

export class ConversationController {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // AGENT can only see conversations assigned to them
      const assignedTo = req.user!.role === 'AGENT'
        ? req.user!.userId
        : req.query.assigned_to as string | undefined;

      const result = await conversationService.list(req.user!.organizationId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        assigned_to: assignedTo,
        search: req.query.search as string | undefined,
        instance_id: req.query.instance_id as string | undefined,
        label: req.query.label as string | undefined,
      });
      sendSuccess(res, result.conversations, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversation = await conversationService.getById(req.user!.organizationId, req.params.id as string);
      verifyAgentAccess(req, conversation);
      sendSuccess(res, conversation);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify conversation belongs to org + AGENT access
      const conversation = await conversationService.getById(req.user!.organizationId, req.params.id as string);
      verifyAgentAccess(req, conversation);

      const result = await messageService.getByConversation(req.user!.organizationId, req.params.id as string, {
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

      // Verify AGENT access
      const conversation = await conversationService.getById(orgId, conversationId);
      verifyAgentAccess(req, conversation);

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
      // Verify AGENT access before resolving
      const conv = await conversationService.getById(req.user!.organizationId, req.params.id as string);
      verifyAgentAccess(req, conv);

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
      // Verify AGENT access before reopening
      const conv = await conversationService.getById(req.user!.organizationId, req.params.id as string);
      verifyAgentAccess(req, conv);

      const conversation = await conversationService.reopen(
        req.user!.organizationId,
        req.params.id as string
      );
      sendSuccess(res, conversation, 'Conversation reopened');
    } catch (error) {
      next(error);
    }
  }

  async listLabels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const labels = await conversationService.listLabels(req.user!.organizationId);
      sendSuccess(res, labels);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify AGENT access before marking read
      const conv = await conversationService.getById(req.user!.organizationId, req.params.id as string);
      verifyAgentAccess(req, conv);

      await conversationService.markAsRead(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      const conversationId = req.params.id as string;
      const messageId = req.params.messageId as string;
      const deleteFor = (req.body.delete_for || 'everyone') as 'everyone' | 'me';

      // Verify AGENT access
      const conv = await conversationService.getById(orgId, conversationId);
      verifyAgentAccess(req, conv);

      const message = await messageService.deleteMessage(orgId, conversationId, messageId, deleteFor);
      sendSuccess(res, message, 'Message deleted');
    } catch (error) {
      next(error);
    }
  }

  async editMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      const conversationId = req.params.id as string;
      const messageId = req.params.messageId as string;
      const newText = req.body.new_text as string;

      // Verify AGENT access
      const conv = await conversationService.getById(orgId, conversationId);
      verifyAgentAccess(req, conv);

      const message = await messageService.editMessage(orgId, conversationId, messageId, newText);
      sendSuccess(res, message, 'Message edited');
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();
