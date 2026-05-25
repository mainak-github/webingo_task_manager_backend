import type { Response, NextFunction } from 'express';
import { projectRepository } from '../repositories/project.repository';
import { taskRepository } from '../repositories/task.repository';
import { Task } from '../models/Task';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import type { AuthenticatedRequest } from './auth.middleware';
import type { Role } from '../constants/roles';

export function restrictToProjectRole(allowedRoles: Role[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new ForbiddenError('Access Denied. Authenticated user required.'));
      }

      // Try parsing projectId from params, query, or body
      const projectId = req.params.projectId || req.query.projectId?.toString() || req.body.projectId;

      if (!projectId) {
        return next(new ForbiddenError('Access Denied. Project Context ID is missing.'));
      }

      // Query database for user role within this specific project
      const userRole = await projectRepository.getUserRoleInProject(projectId, userId);

      if (!userRole) {
        return next(new ForbiddenError('Access Denied. You are not a member of this project.'));
      }

      // If user is Project Admin (role: 'admin'), they get a pass automatically
      if (userRole === 'admin') {
        return next();
      }

      // Check if user's role is in the list of allowed roles
      if (!allowedRoles.includes(userRole)) {
        return next(new ForbiddenError('Access Denied. Insufficient permissions for this project role.'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function restrictToTaskRole(allowedRoles: Role[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new ForbiddenError('Access Denied. Authenticated user required.'));
      }

      const { taskId } = req.params;
      if (!taskId) {
        return next(new ForbiddenError('Access Denied. Task ID is missing.'));
      }

      const task = await Task.findById(taskId, 'projectId').lean();
      if (!task) {
        return next(new NotFoundError('Task not found.'));
      }

      const userRole = await projectRepository.getUserRoleInProject(task.projectId.toString(), userId);
      if (!userRole) {
        return next(new ForbiddenError('Access Denied. You are not a member of this project.'));
      }

      // If user is Project Admin, they get a pass automatically
      if (userRole === 'admin') {
        return next();
      }

      if (!allowedRoles.includes(userRole)) {
        return next(new ForbiddenError('Access Denied. Insufficient permissions for this project role.'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
