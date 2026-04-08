import { Request, Response, NextFunction } from 'express';
import { holidayService } from '../services/holiday.service';
import { sendSuccess } from '../utils/api-response';

class HolidayController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const data = await holidayService.list(req.user!.organizationId, year);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await holidayService.create(req.user!.organizationId, req.body);
      sendSuccess(res, data, 'Hari libur berhasil ditambahkan', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await holidayService.update(req.user!.organizationId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Hari libur berhasil diupdate');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await holidayService.delete(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, null, 'Hari libur berhasil dihapus');
    } catch (error) {
      next(error);
    }
  }
}

export const holidayController = new HolidayController();
