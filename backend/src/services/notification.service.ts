import { prisma } from '../config/database';
import { getIO } from '../socket/io';

type NotificationType = 'NEW_MESSAGE' | 'ASSIGNED' | 'MENTION' | 'BROADCAST_COMPLETED' | 'INSTANCE_DISCONNECTED' | 'SLA_WARNING' | 'SLA_BREACHED' | 'TASK_DUE' | 'TASK_ASSIGNED' | 'DEAL_ROTTEN' | 'SYSTEM';

export class NotificationService {
  async list(userId: string, limit = 30, offset = 0) {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: { user_id: userId, is_read: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async create(userId: string, type: NotificationType, title: string, body?: string, data?: Record<string, any>) {
    const notification = await prisma.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        body: body || null,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    });

    // Emit realtime notification via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }

    return notification;
  }

  async notifyAssigned(userId: string, contactName: string, conversationId: string) {
    return this.create(userId, 'ASSIGNED', 'Percakapan ditugaskan', `Percakapan dengan ${contactName} ditugaskan kepada Anda`, { conversation_id: conversationId });
  }

  async notifyNewMessage(userId: string, contactName: string, preview: string, conversationId: string) {
    return this.create(userId, 'NEW_MESSAGE', `Pesan baru dari ${contactName}`, preview.slice(0, 100), { conversation_id: conversationId });
  }

  async notifyBroadcastCompleted(userId: string, broadcastName: string) {
    return this.create(userId, 'BROADCAST_COMPLETED', 'Broadcast selesai', `Broadcast "${broadcastName}" telah selesai dikirim`);
  }

  async notifyInstanceDisconnected(userId: string, instanceName: string) {
    return this.create(userId, 'INSTANCE_DISCONNECTED', 'Instance terputus', `WhatsApp instance "${instanceName}" terputus. Silakan sambungkan kembali.`);
  }
}

export const notificationService = new NotificationService();
