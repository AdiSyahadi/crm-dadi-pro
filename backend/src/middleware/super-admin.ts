import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';

/**
 * Middleware: Requires the authenticated user to have SUPER_ADMIN role.
 * Must be placed AFTER authenticate middleware.
 * Bypasses tenant scope — no organizationId required on req.
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    next(AppError.forbidden('Akses khusus Super Admin'));
    return;
  }

  next();
}
