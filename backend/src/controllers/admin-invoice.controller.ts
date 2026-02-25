import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';

export class AdminInvoiceController {
  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.listAll({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        organization_id: req.query.organization_id as string | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.getById(req.params.id as string);
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.create(req.body);
      res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.verifyPayment(
        req.params.id as string,
        req.user!.userId,
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.cancel(req.params.id as string);
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  /** Tenant: list own invoices */
  async listOwn(req: Request, res: Response, next: NextFunction) {
    try {
      const invoices = await invoiceService.listByOrg(req.user!.organizationId);
      res.json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  }

  /** Tenant: upload payment proof */
  async uploadProof(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.uploadProof(
        req.params.id as string,
        req.user!.organizationId,
        req.body.payment_proof_url,
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }
}

export const adminInvoiceController = new AdminInvoiceController();
