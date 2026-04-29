import { prisma } from '../config/database';
import { ListActivityLogsInput, CreateActivityLogInput } from '../validators/activity-log.validator';

class ActivityLogService {
  async list(organizationId: string, input: ListActivityLogsInput) {
    const { page, limit, entity_type, entity_id, user_id, action, sort_order } = input;

    const where: any = { organization_id: organizationId };
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = entity_id;
    if (user_id) where.user_id = user_id;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { created_at: sort_order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(organizationId: string, userId: string, input: CreateActivityLogInput, ipAddress?: string) {
    return prisma.activityLog.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        contact_id: input.contact_id,
        details: input.details,
        ip_address: ipAddress,
      },
    });
  }

  async log(organizationId: string, userId: string, action: string, entityType: string, entityId?: string, details?: Record<string, any>, ipAddress?: string) {
    return prisma.activityLog.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ipAddress,
      },
    });
  }
}

export const activityLogService = new ActivityLogService();
