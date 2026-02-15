import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { prisma } from '../config/database';

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
}

export async function tenantGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw AppError.unauthorized();
    }

    const organizationId = req.user.organizationId;

    // Verify organization exists and is active
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, is_active: true },
    });

    if (!org) {
      throw AppError.notFound('Organization not found');
    }

    if (!org.is_active) {
      throw AppError.forbidden('Organization is deactivated');
    }

    req.organizationId = organizationId;
    next();
  } catch (error) {
    next(error);
  }
}
