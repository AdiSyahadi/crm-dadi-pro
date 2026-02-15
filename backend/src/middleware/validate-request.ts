import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/api-response';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error.errors) {
        sendError(
          _res,
          'VALIDATION_ERROR',
          'Validation failed',
          400,
          error.errors
        );
        return;
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error: any) {
      if (error.errors) {
        sendError(
          _res,
          'VALIDATION_ERROR',
          'Query validation failed',
          400,
          error.errors
        );
        return;
      }
      next(error);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error: any) {
      if (error.errors) {
        sendError(
          _res,
          'VALIDATION_ERROR',
          'Params validation failed',
          400,
          error.errors
        );
        return;
      }
      next(error);
    }
  };
}
