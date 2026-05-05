import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

export class ChatbotService {
  async list(organizationId: string) {
    return prisma.automation.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const automation = await prisma.automation.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!automation) throw AppError.notFound('Chatbot flow tidak ditemukan');
    return automation;
  }

  async create(organizationId: string, data: {
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config?: any;
    action_type: string;
    action_config?: any;
    priority?: number;
    is_active?: boolean;
    wa_instance_id?: string;
  }) {
    return prisma.automation.create({
      data: {
        organization_id: organizationId,
        name: data.name,
        description: data.description || null,
        trigger_type: data.trigger_type as any,
        trigger_config: data.trigger_config || {},
        action_type: data.action_type as any,
        action_config: data.action_config || {},
        priority: data.priority ?? 0,
        is_active: data.is_active ?? true,
        wa_instance_id: data.wa_instance_id || null,
      },
    });
  }

  async update(organizationId: string, id: string, data: {
    name?: string;
    description?: string;
    trigger_type?: string;
    trigger_config?: any;
    action_type?: string;
    action_config?: any;
    priority?: number;
    is_active?: boolean;
    wa_instance_id?: string | null;
  }) {
    await this.getById(organizationId, id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.trigger_type !== undefined) updateData.trigger_type = data.trigger_type;
    if (data.trigger_config !== undefined) updateData.trigger_config = data.trigger_config;
    if (data.action_type !== undefined) updateData.action_type = data.action_type;
    if (data.action_config !== undefined) updateData.action_config = data.action_config;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.wa_instance_id !== undefined) updateData.wa_instance_id = data.wa_instance_id || null;

    return prisma.automation.update({ where: { id }, data: updateData });
  }

  async delete(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.automation.delete({ where: { id } });
  }

  async toggle(organizationId: string, id: string) {
    const automation = await this.getById(organizationId, id);
    return prisma.automation.update({
      where: { id },
      data: { is_active: !automation.is_active },
    });
  }

  async duplicate(organizationId: string, id: string) {
    const original = await this.getById(organizationId, id);
    return prisma.automation.create({
      data: {
        organization_id: organizationId,
        name: `${original.name} (Copy)`,
        description: original.description,
        trigger_type: original.trigger_type,
        trigger_config: original.trigger_config || {},
        action_type: original.action_type,
        action_config: original.action_config || {},
        wa_instance_id: original.wa_instance_id,
        priority: original.priority,
        is_active: false,
      },
    });
  }

  /**
   * Process incoming message against active chatbot rules
   */
  async processMessage(organizationId: string, message: string, context: {
    isFirstMessage: boolean;
    contactId: string;
    conversationId: string;
    instanceId?: string;
  }): Promise<{ matched: boolean; action?: any }> {
    const automations = await prisma.automation.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        OR: [
          { wa_instance_id: null },
          ...(context.instanceId ? [{ wa_instance_id: context.instanceId }] : []),
        ],
      },
      orderBy: { priority: 'desc' },
    });

    for (const auto of automations) {
      const triggerConfig = (auto.trigger_config as any) || {};
      let matches = false;

      switch (auto.trigger_type) {
        case 'KEYWORD_MATCH': {
          const keywords: string[] = triggerConfig.keywords || [];
          const lowerMsg = message.toLowerCase();
          matches = keywords.some((k: string) => lowerMsg.includes(k.toLowerCase()));
          break;
        }
        case 'FIRST_MESSAGE':
          matches = context.isFirstMessage;
          break;
        case 'MESSAGE_RECEIVED':
          matches = true;
          break;
        default:
          break;
      }

      if (matches) {
        // Increment execution count
        await prisma.automation.update({
          where: { id: auto.id },
          data: { execution_count: { increment: 1 } },
        });

        return {
          matched: true,
          action: {
            type: auto.action_type,
            config: auto.action_config,
          },
        };
      }
    }

    return { matched: false };
  }
}

export const chatbotService = new ChatbotService();
