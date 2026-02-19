import { Request, Response, NextFunction } from 'express';
import { contactService } from '../services/contact.service';
import { createContactSchema, updateContactSchema, listContactsSchema, importContactsSchema } from '../validators/contact.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class ContactController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listContactsSchema.parse(req.query);
      // AGENT can only see contacts that have conversations assigned to them
      const assignedToUserId = req.user!.role === 'AGENT' ? req.user!.userId : undefined;
      const result = await contactService.list(req.user!.organizationId, input, assignedToUserId);
      sendSuccess(res, result.contacts, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignedToUserId = req.user!.role === 'AGENT' ? req.user!.userId : undefined;
      const contact = await contactService.getById(req.user!.organizationId, req.params.id as string, assignedToUserId);
      sendSuccess(res, contact);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createContactSchema.parse(req.body);
      const contact = await contactService.create(req.user!.organizationId, input);
      sendCreated(res, contact, 'Contact created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateContactSchema.parse(req.body);
      const contact = await contactService.update(req.user!.organizationId, req.params.id as string, input);
      sendSuccess(res, contact, 'Contact updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await contactService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async listTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await contactService.listTags(req.user!.organizationId);
      sendSuccess(res, tags);
    } catch (error) {
      next(error);
    }
  }

  async createTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, color, description } = req.body;
      if (!name) { res.status(400).json({ success: false, message: 'Name is required' }); return; }
      const tag = await contactService.createTag(req.user!.organizationId, { name, color, description });
      sendCreated(res, tag, 'Label created');
    } catch (error) {
      next(error);
    }
  }

  async updateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tag = await contactService.updateTag(req.user!.organizationId, req.params.id as string, req.body);
      sendSuccess(res, tag, 'Label updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await contactService.deleteTag(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async bulkAssignTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contact_ids, tags } = req.body;
      if (!contact_ids?.length || !tags?.length) {
        res.status(400).json({ success: false, message: 'contact_ids and tags are required' });
        return;
      }
      const result = await contactService.bulkAssignTags(req.user!.organizationId, contact_ids, tags);
      sendSuccess(res, result, 'Tags assigned');
    } catch (error) {
      next(error);
    }
  }

  async importContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contacts } = importContactsSchema.parse(req.body);
      const result = await contactService.importContacts(req.user!.organizationId, contacts);
      sendSuccess(res, result, 'Import completed');
    } catch (error) {
      next(error);
    }
  }
}

export const contactController = new ContactController();
