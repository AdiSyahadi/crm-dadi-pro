import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { sendError } from '../utils/api-response';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError || (err as any).isOperational === true;
  if (isAppError) {
    const appErr = err as AppError;
    sendError(res, appErr.code, appErr.message, appErr.statusCode);
    return;
  }

  // Axios errors from external API calls (e.g. WA API)
  if ((err as any).isAxiosError && (err as any).response) {
    const axiosStatus = (err as any).response.status;
    const axiosMsg = (err as any).response.data?.message || err.message;
    sendError(res, axiosStatus === 404 ? 'NOT_FOUND' : 'EXTERNAL_API_ERROR', axiosMsg, axiosStatus >= 500 ? 502 : axiosStatus);
    return;
  }

  // Prisma known errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      sendError(res, 'DUPLICATE', 'Resource already exists', 409);
      return;
    }
    if (prismaErr.code === 'P2025') {
      sendError(res, 'NOT_FOUND', 'Resource not found', 404);
      return;
    }
  }

  // Zod validation errors
  if (err.constructor.name === 'ZodError' || (err as any).issues) {
    const zodErr = err as any;
    const issues = zodErr.issues || zodErr.errors || [];
    const firstIssue = issues[0];
    const message = firstIssue
      ? `${firstIssue.path?.join('.') || 'field'}: ${firstIssue.message}`
      : 'Validation failed';
    sendError(res, 'VALIDATION_ERROR', message, 400, issues);
    return;
  }

  // Log unexpected errors
  console.error('❌ Unexpected error:', err);

  sendError(
    res,
    'INTERNAL_ERROR',
    env.isDev ? err.message : 'Internal server error',
    500
  );
}
