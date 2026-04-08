import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

export class TeamService {
  async list(organizationId: string) {
    return prisma.team.findMany({
      where: { organization_id: organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar_url: true, role: true, is_online: true },
            },
          },
        },
        _count: { select: { assigned_conversations: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async getById(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organization_id: organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar_url: true, role: true, is_online: true },
            },
          },
        },
      },
    });

    if (!team) throw AppError.notFound('Team not found');
    return team;
  }

  async create(organizationId: string, data: { name: string; description?: string; color?: string; auto_assign?: boolean; assign_strategy?: string; max_open_chats?: number }) {
    return prisma.team.create({
      data: {
        organization_id: organizationId,
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        auto_assign: data.auto_assign || false,
        assign_strategy: (data.assign_strategy as any) || 'ROUND_ROBIN',
        max_open_chats: data.max_open_chats || 20,
      },
    });
  }

  async update(organizationId: string, teamId: string, data: { name?: string; description?: string; color?: string; auto_assign?: boolean; assign_strategy?: string; max_open_chats?: number }) {
    await this.getById(organizationId, teamId);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.auto_assign !== undefined) updateData.auto_assign = data.auto_assign;
    if (data.assign_strategy !== undefined) updateData.assign_strategy = data.assign_strategy;
    if (data.max_open_chats !== undefined) updateData.max_open_chats = data.max_open_chats;

    return prisma.team.update({ where: { id: teamId }, data: updateData });
  }

  async delete(organizationId: string, teamId: string) {
    await this.getById(organizationId, teamId);
    await prisma.team.delete({ where: { id: teamId } });
  }

  async addMember(organizationId: string, teamId: string, userId: string, isLeader = false) {
    await this.getById(organizationId, teamId);

    // Verify user belongs to same org
    const user = await prisma.user.findFirst({
      where: { id: userId, organization_id: organizationId },
    });
    if (!user) throw AppError.notFound('User not found in this organization');

    try {
      return await prisma.teamMember.create({
        data: { team_id: teamId, user_id: userId, is_leader: isLeader },
        include: {
          user: { select: { id: true, name: true, email: true, avatar_url: true, role: true } },
        },
      });
    } catch {
      throw AppError.conflict('User is already a member of this team');
    }
  }

  async removeMember(organizationId: string, teamId: string, userId: string) {
    await this.getById(organizationId, teamId);

    const member = await prisma.teamMember.findFirst({
      where: { team_id: teamId, user_id: userId },
    });

    if (!member) throw AppError.notFound('Member not found in this team');

    await prisma.teamMember.delete({ where: { id: member.id } });
  }

  async listUsers(organizationId: string) {
    return prisma.user.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar_url: true,
        phone: true,
        role: true,
        is_active: true,
        is_online: true,
        last_seen_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async inviteUser(organizationId: string, data: { email: string; name: string; role: string; password?: string }) {
    const existing = await prisma.user.findFirst({
      where: { organization_id: organizationId, email: data.email },
    });
    if (existing) throw AppError.conflict('User with this email already exists in this organization');

    const crypto = await import('crypto');
    const bcrypt = await import('bcryptjs');

    // If password provided (legacy flow), create active user directly
    if (data.password && data.password.length >= 8) {
      const passwordHash = await bcrypt.hash(data.password, 12);
      return prisma.user.create({
        data: {
          organization_id: organizationId,
          email: data.email,
          name: data.name,
          password_hash: passwordHash,
          role: data.role as any,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          invite_token: true,
        },
      });
    }

    // Token-based invite: create inactive user with invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(20).toString('hex'), 4);

    return prisma.user.create({
      data: {
        organization_id: organizationId,
        email: data.email,
        name: data.name,
        password_hash: placeholderHash,
        role: data.role as any,
        is_active: false,
        invite_token: inviteToken,
        invite_token_expires_at: expiresAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        invite_token: true,
      },
    });
  }

  async updateUser(organizationId: string, userId: string, data: { name?: string; role?: string; is_active?: boolean }, callerId?: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organization_id: organizationId },
    });
    if (!user) throw AppError.notFound('User not found');

    // Safety: cannot deactivate yourself
    if (data.is_active === false && callerId === userId) {
      throw AppError.badRequest('Tidak bisa menonaktifkan akun sendiri');
    }

    // Safety: cannot change OWNER role
    if (user.role === 'OWNER' && data.role && data.role !== 'OWNER') {
      throw AppError.badRequest('Tidak bisa mengubah role OWNER');
    }

    // Safety: cannot deactivate OWNER
    if (user.role === 'OWNER' && data.is_active === false) {
      throw AppError.badRequest('Tidak bisa menonaktifkan akun OWNER');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, is_active: true },
    });
  }
  async resetPassword(organizationId: string, userId: string, newPassword: string, callerRole: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organization_id: organizationId },
    });
    if (!user) throw AppError.notFound('User not found');

    if (user.role === 'OWNER') throw AppError.badRequest('Tidak bisa reset password OWNER dari sini');
    if (callerRole === 'ADMIN' && user.role !== 'AGENT') throw AppError.forbidden('Admin hanya bisa reset password Agent');

    if (newPassword.length < 8) throw AppError.badRequest('Password minimal 8 karakter');

    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}

export const teamService = new TeamService();
