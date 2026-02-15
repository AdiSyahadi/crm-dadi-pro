import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { WAApiClient } from './wa-api.client';
import { CreateInstanceInput, UpdateInstanceInput } from '../validators/wa-instance.validator';

export class WAInstanceService {
  async list(organizationId: string) {
    return prisma.wAInstance.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getById(organizationId: string, instanceId: string) {
    const instance = await prisma.wAInstance.findFirst({
      where: { id: instanceId, organization_id: organizationId },
    });

    if (!instance) {
      throw AppError.notFound('WA Instance not found');
    }

    return instance;
  }

  async create(organizationId: string, input: CreateInstanceInput) {
    // Check duplicate by wa_instance_id
    const existing = await prisma.wAInstance.findFirst({
      where: {
        organization_id: organizationId,
        wa_instance_id: input.wa_instance_id,
      },
    });

    if (existing) {
      throw AppError.conflict('Instance already registered');
    }

    // Try to verify instance on WA API, but don't fail if API is not configured
    let remotePhone: string | null = (input as any).phone_number || null;
    let remoteStatus: string = 'DISCONNECTED';

    try {
      const waClient = await WAApiClient.forOrganization(organizationId);
      const remoteInstance = await waClient.getInstance(input.wa_instance_id);
      if (remoteInstance?.phone_number) remotePhone = remoteInstance.phone_number;
      if (remoteInstance?.status === 'connected') remoteStatus = 'CONNECTED';
    } catch {
      // WA API not configured or unreachable — continue with local record
    }

    const instance = await prisma.wAInstance.create({
      data: {
        organization_id: organizationId,
        wa_instance_id: input.wa_instance_id,
        name: input.name,
        phone_number: remotePhone,
        status: remoteStatus as any,
        is_default: input.is_default || false,
      },
    });

    // If this is set as default, unset others
    if (input.is_default) {
      await prisma.wAInstance.updateMany({
        where: {
          organization_id: organizationId,
          id: { not: instance.id },
        },
        data: { is_default: false },
      });
    }

    return instance;
  }

  async update(organizationId: string, instanceId: string, input: UpdateInstanceInput) {
    const existing = await this.getById(organizationId, instanceId);

    const instance = await prisma.wAInstance.update({
      where: { id: existing.id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.wa_instance_id && { wa_instance_id: input.wa_instance_id }),
        ...(input.phone_number && { phone_number: input.phone_number }),
        ...(input.daily_limit !== undefined && { daily_limit: input.daily_limit }),
        ...(input.is_default !== undefined && { is_default: input.is_default }),
      },
    });

    if (input.is_default) {
      await prisma.wAInstance.updateMany({
        where: {
          organization_id: organizationId,
          id: { not: instance.id },
        },
        data: { is_default: false },
      });
    }

    return instance;
  }

  async delete(organizationId: string, instanceId: string) {
    const existing = await this.getById(organizationId, instanceId);
    await prisma.wAInstance.delete({ where: { id: existing.id } });
  }

  async getStatus(organizationId: string, instanceId: string) {
    const instance = await this.getById(organizationId, instanceId);

    try {
      const waClient = await WAApiClient.forOrganization(organizationId);
      const status = await waClient.getInstanceStatus(instance.wa_instance_id);

      // Update local status
      const newStatus = status?.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED';
      await prisma.wAInstance.update({
        where: { id: instance.id },
        data: {
          status: newStatus as any,
          phone_number: status?.phone_number || instance.phone_number,
          last_synced_at: new Date(),
          ...(newStatus === 'CONNECTED' && !instance.connected_at ? { connected_at: new Date() } : {}),
        },
      });

      return { ...instance, status: newStatus, remote: status };
    } catch {
      return { ...instance, remote: null };
    }
  }

  async getQR(organizationId: string, instanceId: string) {
    const instance = await this.getById(organizationId, instanceId);
    try {
      const waClient = await WAApiClient.forOrganization(organizationId);

      // Check remote status first
      const remoteStatus = await waClient.getInstanceStatus(instance.wa_instance_id);

      if (!remoteStatus) {
        throw AppError.notFound(
          `Instance "${instance.name}" tidak ditemukan di WA API. Hapus dan tambahkan ulang dengan ID yang benar.`
        );
      }

      // If already connected, sync status and inform user
      if (remoteStatus.status === 'connected') {
        await prisma.wAInstance.update({
          where: { id: instance.id },
          data: {
            status: 'CONNECTED' as any,
            phone_number: remoteStatus.phone_number || instance.phone_number,
            last_synced_at: new Date(),
            connected_at: instance.connected_at || new Date(),
          },
        });
        return { qr: null, status: 'connected', message: 'Instance sudah terhubung! Tidak perlu scan QR lagi.' };
      }

      // Not connected — QR only available via WA API Dashboard
      return {
        qr: null,
        status: remoteStatus.status,
        message: 'Untuk scan QR, buka WA API Dashboard di http://localhost:3000 lalu hubungkan instance dari sana.',
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      const status = error.response?.status || error.status;
      if (status === 401 || status === 403) {
        throw AppError.badRequest('API Key tidak valid. Periksa konfigurasi WA API di Settings.');
      }
      throw AppError.badRequest('Tidak dapat terhubung ke WA API. Pastikan WA API sudah berjalan.');
    }
  }

  // Fetch available instances from friend's WA API
  async fetchRemoteInstances(organizationId: string) {
    const waClient = await WAApiClient.forOrganization(organizationId);
    const result = await waClient.getInstances();
    return result?.data || result || [];
  }
}

export const waInstanceService = new WAInstanceService();
