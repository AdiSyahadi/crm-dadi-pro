import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { CreateTemplateInput, UpdateTemplateInput, ListTemplatesInput } from '../validators/template.validator';

export class TemplateService {
  async list(organizationId: string, input: ListTemplatesInput) {
    const { page, limit, search, category, is_active } = input;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { content: { contains: search } },
      ];
    }
    if (category) where.category = category;
    if (is_active !== undefined) where.is_active = is_active;

    const [templates, total] = await Promise.all([
      prisma.messageTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          created_by: { select: { id: true, name: true } },
        },
      }),
      prisma.messageTemplate.count({ where }),
    ]);

    return {
      templates,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, templateId: string) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, organization_id: organizationId },
      include: {
        created_by: { select: { id: true, name: true } },
      },
    });
    if (!template) throw AppError.notFound('Template not found');
    return template;
  }

  async create(organizationId: string, userId: string, input: CreateTemplateInput) {
    return prisma.messageTemplate.create({
      data: {
        organization_id: organizationId,
        name: input.name,
        category: input.category || null,
        content: input.content,
        media_url: input.media_url || null,
        media_type: (input.media_type as any) || null,
        variables: input.variables ? JSON.parse(JSON.stringify(input.variables)) : null,
        created_by_id: userId,
      },
    });
  }

  async update(organizationId: string, templateId: string, input: UpdateTemplateInput) {
    await this.getById(organizationId, templateId);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.media_url !== undefined) updateData.media_url = input.media_url;
    if (input.media_type !== undefined) updateData.media_type = input.media_type;
    if (input.variables !== undefined) updateData.variables = JSON.parse(JSON.stringify(input.variables));

    return prisma.messageTemplate.update({ where: { id: templateId }, data: updateData });
  }

  async delete(organizationId: string, templateId: string) {
    await this.getById(organizationId, templateId);
    await prisma.messageTemplate.delete({ where: { id: templateId } });
  }

  async toggleActive(organizationId: string, templateId: string) {
    const template = await this.getById(organizationId, templateId);
    return prisma.messageTemplate.update({
      where: { id: templateId },
      data: { is_active: !template.is_active },
    });
  }

  async incrementUsage(organizationId: string, templateId: string) {
    // Verify template belongs to org, then increment
    await this.getById(organizationId, templateId);
    return prisma.messageTemplate.update({
      where: { id: templateId },
      data: { usage_count: { increment: 1 } },
    });
  }
}

export const templateService = new TemplateService();
