import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { z } from 'zod';
import axios from 'axios';
import { resolveDockerUrl } from '../services/wa-api.client';

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
}

export const settingsController = new SettingsController();
