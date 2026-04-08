import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/task.service';
import { createTaskSchema, updateTaskSchema, listTasksSchema } from '../validators/task.validator';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/api-response';

export class TaskController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = listTasksSchema.parse(req.query);
      const result = await taskService.list(req.user!.organizationId, input);
      sendSuccess(res, result.tasks, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await taskService.getById(req.user!.organizationId, req.params.id as string);
      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTaskSchema.parse(req.body);
      const task = await taskService.create(req.user!.organizationId, req.user!.userId, input);
      sendCreated(res, task, 'Task created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateTaskSchema.parse(req.body);
      const task = await taskService.update(req.user!.organizationId, req.user!.userId, req.params.id as string, input);
      sendSuccess(res, task, 'Task updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await taskService.delete(req.user!.organizationId, req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.query.user_id as string | undefined;
      const result = await taskService.summary(req.user!.organizationId, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
