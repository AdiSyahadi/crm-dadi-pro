import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversation.service';
import { messageService } from '../services/message.service';
import { sendSuccess, sendCreated } from '../utils/api-response';
import { AppError } from '../utils/app-error';

/**
 * AGENT role guard: verify the conversation is assigned to this agent OR unassigned.
 * OWNER/ADMIN/SUPERVISOR can access any conversation in their org.
 * Standalone function so `this` binding is not required.
 */
function verifyAgentAccess(req: Request, conversation: any): void {
  if (req.user!.role === 'AGENT' && conversation.assigned_to_user_id !== null && conversation.assigned_to_user_id !== req.user!.userId) {
    throw AppError.forbidden('Agents can only access conversations assigned to them');
  }
}

export class ConversationController {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // AGENT can only see conversations assigned to them, OR unassigned conversations
      const requestedAssignedTo = req.query.assigned_to as string | undefined;
      const assignedTo = req.user!.role === 'AGENT'
        ? (requestedAssignedTo === 'unassigned' ? 'unassigned' : req.user!.userId)
        : requestedAssignedTo;

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

  async addInternalNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content } = req.body;
      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: { message: 'Content is required' } });
        return;
      }
      const conversationId = req.params.id as string;
      const orgId = req.user!.organizationId;

      const conversation = await conversationService.getById(orgId, conversationId);
      verifyAgentAccess(req, conversation);

      const note = await messageService.addInternalNote(orgId, conversationId, content.trim(), req.user!.userId);
      sendCreated(res, note);
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, team_id, transfer_note } = req.body;
      const conversation = await conversationService.assign(
        req.user!.organizationId,
        req.params.id as string,
        user_id,
        team_id,
        req.user!.userId,
        transfer_note
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

  async addLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { label, color } = req.body;
      if (!label || typeof label !== 'string') {
        res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'label is required' } });
        return;
      }
      const result = await conversationService.addLabel(req.user!.organizationId, req.params.id as string, label, color);
      sendSuccess(res, result, 'Label ditambahkan');
    } catch (error) {
      next(error);
    }
  }

  async removeLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { label } = req.body;
      if (!label || typeof label !== 'string') {
        res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'label is required' } });
        return;
      }
      await conversationService.removeLabel(req.user!.organizationId, req.params.id as string, label);
      sendSuccess(res, null, 'Label dihapus');
    } catch (error) {
      next(error);
    }
  }

  async getConversationLabels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const labels = await conversationService.getConversationLabels(req.params.id as string);
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

  async bulkResolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversation_ids } = req.body;
      if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'conversation_ids wajib diisi (array)' } });
        return;
      }
      const result = await conversationService.bulkResolve(req.user!.organizationId, conversation_ids, req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async bulkAssign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversation_ids, user_id } = req.body;
      if (!Array.isArray(conversation_ids) || conversation_ids.length === 0 || !user_id) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'conversation_ids dan user_id wajib diisi' } });
        return;
      }
      const result = await conversationService.bulkAssign(req.user!.organizationId, conversation_ids, user_id, req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async bulkReopen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversation_ids } = req.body;
      if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'conversation_ids wajib diisi (array)' } });
        return;
      }
      const result = await conversationService.bulkReopen(req.user!.organizationId, conversation_ids);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await conversationService.getSummary(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getTotalUnread(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const total = await conversationService.getTotalUnread(req.user!.organizationId);
      sendSuccess(res, { total });
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();
