import { Request, Response, NextFunction } from 'express';
import { contactService } from '../services/contact.service';
import { createContactSchema, updateContactSchema, listContactsSchema, importContactsSchema } from '../validators/contact.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class ContactController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listContactsSchema.parse(req.query);
      const result = await contactService.list(req.user!.organizationId, input);
      sendSuccess(res, result.contacts, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contact = await contactService.getById(req.user!.organizationId, req.params.id as string);
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
