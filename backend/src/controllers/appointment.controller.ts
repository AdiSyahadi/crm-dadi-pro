import { Request, Response, NextFunction } from 'express';
import { appointmentService } from '../services/appointment.service';

class AppointmentController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await appointmentService.list(req.user!.organizationId, req.query as any);
      res.json({ success: true, data: result.appointments, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointment = await appointmentService.getById(req.params.id as string, req.user!.organizationId);
      if (!appointment) {
        res.status(404).json({ success: false, error: 'Appointment not found' });
        return;
      }
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointment = await appointmentService.create(req.user!.organizationId, req.user!.userId, req.body);
      res.status(201).json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointment = await appointmentService.update(req.params.id as string, req.user!.organizationId, req.body);
      if (!appointment) {
        res.status(404).json({ success: false, error: 'Appointment not found' });
        return;
      }
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointment = await appointmentService.delete(req.params.id as string, req.user!.organizationId);
      if (!appointment) {
        res.status(404).json({ success: false, error: 'Appointment not found' });
        return;
      }
      res.json({ success: true, message: 'Appointment deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
