import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { JwtPayload } from '../middleware/auth';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + crypto.randomBytes(3).toString('hex');
}

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET as jwt.Secret, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshExpiresAt(): Date {
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const value = parseInt(match[1]!, 10);
  const unit = match[2];
  const ms = unit === 'd' ? value * 86400000
    : unit === 'h' ? value * 3600000
    : unit === 'm' ? value * 60000
    : value * 1000;

  return new Date(Date.now() + ms);
}

export class AuthService {
  async register(input: RegisterInput, ipAddress?: string) {
    // Check if email already exists globally
    const existingUser = await prisma.user.findFirst({
      where: { email: input.email },
    });

    if (existingUser) {
      throw AppError.conflict('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);

    // Create organization + owner user in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: generateSlug(input.organizationName),
        },
      });

      const user = await tx.user.create({
        data: {
          organization_id: organization.id,
          email: input.email,
          password_hash: passwordHash,
          name: input.name,
          role: 'OWNER',
        },
      });

      // Generate tokens
      const jwtPayload: JwtPayload = {
        userId: user.id,
        organizationId: organization.id,
        role: user.role,
      };

      const accessToken = generateAccessToken(jwtPayload);
      const refreshToken = generateRefreshToken();

      await tx.refreshToken.create({
        data: {
          user_id: user.id,
          token_hash: hashToken(refreshToken),
          ip_address: ipAddress,
          expires_at: getRefreshExpiresAt(),
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        accessToken,
        refreshToken,
      };
    });

    return result;
  }

  async login(input: LoginInput, ipAddress?: string, deviceInfo?: string) {
    const user = await prisma.user.findFirst({
      where: { email: input.email },
      include: { organization: true },
    });

    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.is_active) {
      throw AppError.forbidden('Account is deactivated');
    }

    if (!user.organization.is_active) {
      throw AppError.forbidden('Organization is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Generate tokens
    const jwtPayload: JwtPayload = {
      userId: user.id,
      organizationId: user.organization_id,
      role: user.role,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(refreshToken),
        ip_address: ipAddress,
        device_info: deviceInfo,
        expires_at: getRefreshExpiresAt(),
      },
    });

    // Update user online status
    await prisma.user.update({
      where: { id: user.id },
      data: { is_online: true, last_seen_at: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        plan: user.organization.plan,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string, ipAddress?: string) {
    const tokenHash = hashToken(token);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        user: {
          include: { organization: true },
        },
      },
    });

    if (!storedToken) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    if (storedToken.revoked_at) {
      throw AppError.unauthorized('Refresh token has been revoked');
    }

    if (storedToken.expires_at < new Date()) {
      throw AppError.unauthorized('Refresh token expired');
    }

    if (!storedToken.user.is_active) {
      throw AppError.forbidden('Account is deactivated');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked_at: new Date() },
    });

    // Generate new tokens
    const jwtPayload: JwtPayload = {
      userId: storedToken.user.id,
      organizationId: storedToken.user.organization_id,
      role: storedToken.user.role,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const newRefreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        user_id: storedToken.user.id,
        token_hash: hashToken(newRefreshToken),
        ip_address: ipAddress,
        expires_at: getRefreshExpiresAt(),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            is_active: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role: user.role,
      is_online: user.is_online,
      last_seen_at: user.last_seen_at,
      organization: user.organization,
      created_at: user.created_at,
    };
  }
}

export const authService = new AuthService();
