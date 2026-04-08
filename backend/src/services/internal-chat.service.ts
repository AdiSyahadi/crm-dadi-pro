import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';
import { getIO } from '../socket/io';

export class InternalChatService {
  async listChats(organizationId: string, userId: string) {
    const chats = await prisma.internalChat.findMany({
      where: {
        organization_id: organizationId,
        participants: { some: { user_id: userId } },
      },
      include: {
        participants: {
          select: {
            user_id: true,
            last_read_at: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
          select: { content: true, created_at: true, sender_id: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Enrich with user names for participants
    const userIds = [...new Set(chats.flatMap(c => c.participants.map(p => p.user_id)))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar_url: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Count unreads per chat for this user
    const unreadCounts = await Promise.all(
      chats.map(async (c) => {
        const myParticipant = c.participants.find(p => p.user_id === userId);
        const lastRead = myParticipant?.last_read_at;
        const where: any = { chat_id: c.id, sender_id: { not: userId } };
        if (lastRead) where.created_at = { gt: lastRead };
        return prisma.internalMessage.count({ where });
      })
    );

    return chats.map((c, i) => ({
      ...c,
      participants: c.participants.map(p => ({
        ...p,
        user: userMap.get(p.user_id) || { id: p.user_id, name: 'Unknown', avatar_url: null },
      })),
      last_message: c.messages[0] || null,
      messages: undefined,
      unread_count: unreadCounts[i],
    }));
  }

  async findOrCreateDM(organizationId: string, userId: string, targetUserId: string) {
    if (userId === targetUserId) throw AppError.badRequest('Tidak bisa chat dengan diri sendiri');

    // Check existing DM
    const existing = await prisma.internalChat.findFirst({
      where: {
        organization_id: organizationId,
        is_group: false,
        AND: [
          { participants: { some: { user_id: userId } } },
          { participants: { some: { user_id: targetUserId } } },
        ],
      },
    });

    if (existing) return existing;

    // Verify target user exists in same org
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organization_id: organizationId },
    });
    if (!targetUser) throw AppError.notFound('User tidak ditemukan');

    return prisma.internalChat.create({
      data: {
        organization_id: organizationId,
        is_group: false,
        participants: {
          create: [
            { user_id: userId },
            { user_id: targetUserId },
          ],
        },
      },
    });
  }

  async createGroup(organizationId: string, userId: string, name: string, memberIds: string[]) {
    const allIds = [...new Set([userId, ...memberIds])];
    return prisma.internalChat.create({
      data: {
        organization_id: organizationId,
        name,
        is_group: true,
        participants: {
          create: allIds.map(id => ({ user_id: id })),
        },
      },
    });
  }

  async getMessages(organizationId: string, chatId: string, userId: string, page = 1, limit = 50) {
    // Verify participation
    const participant = await prisma.internalChatParticipant.findUnique({
      where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
    });
    if (!participant) throw AppError.forbidden('Anda bukan peserta chat ini');

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.internalMessage.findMany({
        where: { chat_id: chatId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.internalMessage.count({ where: { chat_id: chatId } }),
    ]);

    // Enrich sender info
    const senderIds = [...new Set(messages.map(m => m.sender_id))];
    const senders = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true, avatar_url: true },
    });
    const senderMap = new Map(senders.map(u => [u.id, u]));

    return {
      messages: messages.reverse().map(m => ({
        ...m,
        sender: senderMap.get(m.sender_id) || { id: m.sender_id, name: 'Unknown', avatar_url: null },
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async sendMessage(organizationId: string, chatId: string, userId: string, content: string) {
    // Verify participation
    const participant = await prisma.internalChatParticipant.findUnique({
      where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
    });
    if (!participant) throw AppError.forbidden('Anda bukan peserta chat ini');

    const message = await prisma.internalMessage.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        content,
      },
    });

    // Update chat timestamp
    await prisma.internalChat.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    });

    // Update sender's last_read
    await prisma.internalChatParticipant.update({
      where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
      data: { last_read_at: new Date() },
    });

    // Get sender info
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar_url: true },
    });

    const enrichedMessage = { ...message, sender };

    // Emit via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`internal-chat:${chatId}`).emit('internal:message', enrichedMessage);
    }

    return enrichedMessage;
  }

  async markRead(chatId: string, userId: string) {
    await prisma.internalChatParticipant.update({
      where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
      data: { last_read_at: new Date() },
    });
  }
}

export const internalChatService = new InternalChatService();
