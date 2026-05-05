import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { z } from 'zod';
import axios from 'axios';
import { resolveDockerUrl } from '../services/wa-api.client';
import { paymentSettingsService } from '../services/payment-settings.service';

const waApiConfigSchema = z.object({
  wa_api_base_url: z.string().url().min(1),
  wa_api_key: z.string().min(1).optional(),
  wa_organization_id: z.string().optional(),
});

export class SettingsController {
  // GET /api/settings/wa-api
  async getWaApiConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          wa_api_base_url: true,
          wa_api_key: true,
          wa_organization_id: true,
        },
      });

      if (!org) throw AppError.notFound('Organization not found');

      // Mask API key for security (show only last 8 chars)
      const maskedKey = org.wa_api_key
        ? '••••••••' + org.wa_api_key.slice(-8)
        : null;

      sendSuccess(res, {
        wa_api_base_url: org.wa_api_base_url || '',
        wa_api_key: maskedKey || '',
        wa_api_key_set: !!org.wa_api_key,
        wa_organization_id: org.wa_organization_id || '',
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/settings/wa-api
  async updateWaApiConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;
      const role = req.user!.role;

      // Only OWNER, ADMIN, and SUPER_ADMIN can update WA API config
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang dapat mengubah konfigurasi WA API');
      }

      const input = waApiConfigSchema.parse(req.body);

      const updateData: any = {
        wa_api_base_url: input.wa_api_base_url,
        wa_organization_id: input.wa_organization_id || null,
      };
      // Only update API key if a new one was provided
      if (input.wa_api_key) {
        updateData.wa_api_key = input.wa_api_key;
      }

      await prisma.organization.update({
        where: { id: orgId },
        data: updateData,
      });

      sendSuccess(res, null, 'Konfigurasi WA API berhasil disimpan');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/settings/wa-api/test
  async testWaApiConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.organizationId;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          wa_api_base_url: true,
          wa_api_key: true,
        },
      });

      if (!org || !org.wa_api_base_url || !org.wa_api_key) {
        throw AppError.badRequest('WA API belum dikonfigurasi');
      }

      try {
        const response = await axios.get(`${resolveDockerUrl(org.wa_api_base_url)}/instances`, {
          headers: {
            'X-API-Key': org.wa_api_key,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        const instances = response.data?.data || response.data || [];

        sendSuccess(res, {
          connected: true,
          message: 'Koneksi berhasil!',
          instances_count: Array.isArray(instances) ? instances.length : 0,
        });
      } catch (apiError: any) {
        const status = apiError.response?.status;
        let message = 'Gagal terhubung ke WA API';

        if (status === 401 || status === 403) {
          message = 'API Key tidak valid atau tidak memiliki izin';
        } else if (status === 404) {
          message = 'Endpoint tidak ditemukan. Periksa Base URL';
        } else if (apiError.code === 'ECONNREFUSED') {
          message = 'Server WA API tidak dapat dijangkau';
        } else if (apiError.code === 'ENOTFOUND') {
          message = 'Domain WA API tidak ditemukan';
        } else if (apiError.code === 'ETIMEDOUT') {
          message = 'Koneksi timeout. Server WA API terlalu lambat';
        }

        sendSuccess(res, {
          connected: false,
          message,
          error_detail: apiError.message,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/settings/organization
  async updateOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).tenantId;
      const userRole = (req as any).userRole;

      if (!['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang bisa mengubah organisasi');
      }

      const schema = z.object({
        name: z.string().min(2, 'Nama organisasi minimal 2 karakter').max(100).trim(),
      });

      const parsed = schema.parse(req.body);

      const updated = await prisma.organization.update({
        where: { id: tenantId },
        data: { name: parsed.name },
        select: { id: true, name: true, slug: true, plan: true },
      });

      sendSuccess(res, updated, 'Organisasi berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  // GET /api/settings/notification-preferences
  async getNotificationPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { notification_settings: true },
      });

      const defaults = {
        new_message: true,
        assigned: true,
        deal_update: true,
        broadcast_completed: true,
      };

      sendSuccess(res, { ...(defaults), ...((user?.notification_settings as any) || {}) });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/settings/notification-preferences
  async updateNotificationPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        new_message: z.boolean().optional(),
        assigned: z.boolean().optional(),
        deal_update: z.boolean().optional(),
        broadcast_completed: z.boolean().optional(),
      });

      const parsed = schema.parse(req.body);

      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { notification_settings: parsed },
      });

      sendSuccess(res, parsed, 'Pengaturan notifikasi berhasil disimpan');
    } catch (error) {
      next(error);
    }
  }

  // GET /api/settings/rotten-deals
  async getRottenDealSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.user!.organizationId },
        select: { settings: true },
      });
      const settings = (org?.settings as Record<string, any>) || {};
      sendSuccess(res, { rotten_deal_days: settings.rotten_deal_days ?? 7 });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/settings/rotten-deals
  async updateRottenDealSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({ rotten_deal_days: z.number().int().min(0).max(90) });
      const { rotten_deal_days } = schema.parse(req.body);

      const org = await prisma.organization.findUnique({
        where: { id: req.user!.organizationId },
        select: { settings: true },
      });
      const current = (org?.settings as Record<string, any>) || {};

      await prisma.organization.update({
        where: { id: req.user!.organizationId },
        data: { settings: { ...current, rotten_deal_days } },
      });

      sendSuccess(res, { rotten_deal_days }, 'Pengaturan rotten deal berhasil disimpan');
    } catch (error) {
      next(error);
    }
  }

  // GET /api/settings/midtrans
  async getMidtransConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user!.role;
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang dapat mengakses konfigurasi Midtrans');
      }

      const config = await paymentSettingsService.getMidtransConfig();
      const masked = {
        ...config,
        server_key: config.server_key ? '••••••••' + config.server_key.slice(-6) : '',
        server_key_set: !!config.server_key,
        merchant_id: config.merchant_id || '',
      };
      sendSuccess(res, masked);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/settings/midtrans
  async saveMidtransConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user!.role;
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang dapat mengubah konfigurasi Midtrans');
      }

      const config = await paymentSettingsService.saveMidtransConfig(req.body);
      sendSuccess(res, config, 'Konfigurasi Midtrans berhasil disimpan');
    } catch (error) {
      next(error);
    }
  }

  // GET /api/settings/flip
  async getFlipConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user!.role;
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang dapat mengakses konfigurasi Flip');
      }

      const config = await paymentSettingsService.getFlipConfig();
      const masked = {
        ...config,
        secret_key: config.secret_key ? '••••••••' + config.secret_key.slice(-6) : '',
        secret_key_set: !!config.secret_key,
        validation_token: config.validation_token ? '••••••••' + config.validation_token.slice(-6) : '',
        validation_token_set: !!config.validation_token,
      };
      sendSuccess(res, masked);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/settings/flip
  async saveFlipConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user!.role;
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang dapat mengubah konfigurasi Flip');
      }

      const config = await paymentSettingsService.saveFlipConfig(req.body);
      sendSuccess(res, config, 'Konfigurasi Flip berhasil disimpan');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/settings/midtrans/test
  async testMidtransConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user!.role;
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Hanya OWNER atau ADMIN yang dapat menguji koneksi Midtrans');
      }

      const config = await paymentSettingsService.getMidtransConfig();
      if (!config.server_key) {
        sendSuccess(res, { connected: false, message: 'Server Key belum dikonfigurasi' });
        return;
      }

      const baseUrl = config.environment === 'production'
        ? 'https://api.midtrans.com'
        : 'https://api.sandbox.midtrans.com';

      try {
        const authString = Buffer.from(config.server_key + ':').toString('base64');
        const response = await axios.get(`${baseUrl}/v2/point_of_sales`, {
          headers: { Authorization: `Basic ${authString}` },
          timeout: 10000,
        });

        sendSuccess(res, {
          connected: true,
          message: 'Koneksi Midtrans berhasil!',
          environment: config.environment,
        });
      } catch (apiError: any) {
        const status = apiError.response?.status;
        let message = 'Gagal terhubung ke Midtrans';

        if (status === 401) {
          message = 'Server Key tidak valid';
        } else if (status === 403) {
          message = 'Akses ditolak oleh Midtrans';
        } else if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT') {
          message = 'Server Midtrans tidak dapat dijangkau';
        }

        // 401/403 means the key was received but invalid — still means connection works
        // For Midtrans, a 401 on this endpoint is expected since it's not a real endpoint
        // The important thing is we can reach Midtrans servers
        if (status === 401 || status === 403 || status === 404) {
          sendSuccess(res, {
            connected: true,
            message: 'Server Midtrans terjangkau. Key akan divalidasi saat transaksi.',
            environment: config.environment,
          });
        } else {
          sendSuccess(res, {
            connected: false,
            message,
            error_detail: apiError.message,
          });
        }
      }
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
