import { Request, Response, NextFunction } from 'express';
import { paymentSettingsService } from '../services/payment-settings.service';

export class PaymentSettingsController {
  // ===================== BANK ACCOUNTS =====================

  async listBanks(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await paymentSettingsService.listBankAccounts();
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  }

  async createBank(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await paymentSettingsService.createBankAccount(req.body);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  async updateBank(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await paymentSettingsService.updateBankAccount(req.params.id as string, req.body);
      res.json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  async deleteBank(req: Request, res: Response, next: NextFunction) {
    try {
      await paymentSettingsService.deleteBankAccount(req.params.id as string);
      res.json({ success: true, data: null, message: 'Rekening bank berhasil dihapus' });
    } catch (error) {
      next(error);
    }
  }

  // ===================== MIDTRANS CONFIG =====================

  async getMidtransConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await paymentSettingsService.getMidtransConfig();
      // Mask server key for security
      const masked = {
        ...config,
        server_key: config.server_key ? '••••••••' + config.server_key.slice(-6) : '',
        server_key_set: !!config.server_key,
        merchant_id: config.merchant_id || '',
      };
      res.json({ success: true, data: masked });
    } catch (error) {
      next(error);
    }
  }

  async saveMidtransConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await paymentSettingsService.saveMidtransConfig(req.body);
      res.json({ success: true, data: config, message: 'Konfigurasi Midtrans berhasil disimpan' });
    } catch (error) {
      next(error);
    }
  }

  // ===================== PUBLIC: Payment info for tenants =====================

  async getPublicPaymentInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const info = await paymentSettingsService.getPublicPaymentInfo();
      res.json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  }

  // ===================== FOLLOW-UP WA TEMPLATE =====================

  async getFollowUpTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paymentSettingsService.getFollowUpTemplate();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveFollowUpTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paymentSettingsService.saveFollowUpTemplate(req.body);
      res.json({ success: true, data, message: 'Template follow-up berhasil disimpan' });
    } catch (error) {
      next(error);
    }
  }

  // ===================== VERIFIED WA TEMPLATE =====================

  async getVerifiedTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paymentSettingsService.getVerifiedTemplate();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveVerifiedTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paymentSettingsService.saveVerifiedTemplate(req.body);
      res.json({ success: true, data, message: 'Template verifikasi berhasil disimpan' });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentSettingsController = new PaymentSettingsController();
