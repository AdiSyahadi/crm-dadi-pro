import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

export class SavedFilterService {
  async list(organizationId: string, userId: string, entity?: string) {
    const where: any = { organization_id: organizationId, user_id: userId };
    if (entity) where.entity = entity;

    return prisma.savedFilter.findMany({
      where,
      orderBy: [{ is_default: 'desc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
    });
  }

  async getById(organizationId: string, userId: string, id: string) {
    const filter = await prisma.savedFilter.findFirst({
      where: { id, organization_id: organizationId, user_id: userId },
    });
    if (!filter) throw AppError.notFound('Saved filter not found');
    return filter;
  }

  async create(organizationId: string, userId: string, data: {
    name: string;
    entity: string;
    filters: any;
    is_default?: boolean;
    sort_order?: number;
  }) {
    if (!['conversation', 'contact', 'deal'].includes(data.entity)) {
      throw AppError.badRequest('Entity harus conversation, contact, atau deal');
    }

    // If setting as default, unset other defaults for same entity
    if (data.is_default) {
      await prisma.savedFilter.updateMany({
        where: { organization_id: organizationId, user_id: userId, entity: data.entity, is_default: true },
        data: { is_default: false },
      });
    }

    return prisma.savedFilter.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        name: data.name,
        entity: data.entity,
        filters: data.filters,
        is_default: data.is_default || false,
        sort_order: data.sort_order ?? 0,
      },
    });
  }

  async update(organizationId: string, userId: string, id: string, data: {
    name?: string;
    filters?: any;
    is_default?: boolean;
    sort_order?: number;
  }) {
    const existing = await this.getById(organizationId, userId, id);

    // If setting as default, unset other defaults for same entity
    if (data.is_default) {
      await prisma.savedFilter.updateMany({
        where: {
          organization_id: organizationId,
          user_id: userId,
          entity: existing.entity,
          is_default: true,
          id: { not: id },
        },
        data: { is_default: false },
      });
    }

    return prisma.savedFilter.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.filters !== undefined && { filters: data.filters }),
        ...(data.is_default !== undefined && { is_default: data.is_default }),
        ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
      },
    });
  }

  async delete(organizationId: string, userId: string, id: string) {
    await this.getById(organizationId, userId, id);
    return prisma.savedFilter.delete({ where: { id } });
  }

  async setDefault(organizationId: string, userId: string, id: string) {
    const filter = await this.getById(organizationId, userId, id);

    // Unset other defaults for same entity
    await prisma.savedFilter.updateMany({
      where: {
        organization_id: organizationId,
        user_id: userId,
        entity: filter.entity,
        is_default: true,
        id: { not: id },
      },
      data: { is_default: false },
    });

    return prisma.savedFilter.update({
      where: { id },
      data: { is_default: true },
    });
  }
}

export const savedFilterService = new SavedFilterService();
