import { taskRepository, type TaskFilters, type QueryOptions } from '../repositories/task.repository';
import { projectRepository } from '../repositories/project.repository';
import { activityRepository } from '../repositories/activity.repository';
import { notificationService } from './notification.service';
import { socketService } from './socket.service';
import { uploadService } from './upload.service';
import { cacheService } from '../config/redis';
import { SOCKET_EVENTS } from '../constants/events';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';
import { ConflictError } from '../errors/ConflictError';
import { logger } from '../utils/logger';
import { Task, type ITask, type IAttachment } from '../models/Task';
import type { Role } from '../constants/roles';
import { Types } from 'mongoose';

export class TaskService {
  private getAnalyticsCacheKey(projectId: string): string {
    return `project:${projectId}:analytics`;
  }

  async createTask(projectId: string, taskData: Partial<ITask>, creatorId: string): Promise<ITask> {
    return logger.profile('TaskService.createTask', async () => {
      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      const creatorRole = await projectRepository.getUserRoleInProject(projectId, creatorId);
      this.assertCanCreateTask(creatorRole, taskData, creatorId);

      const task = await taskRepository.create({
        ...taskData,
        projectId: projectId as any,
        createdBy: creatorId as any,
        updatedBy: creatorId as any,
      });

      // Clear cached analytics
      await cacheService.del(this.getAnalyticsCacheKey(projectId));

      // Log activity
      await activityRepository.log(projectId, creatorId, 'task:create', `Created task "${task.title}"`);

      // Broadcast Socket event to all project room listeners
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_CREATED, {
        task,
        actor: creatorId,
      });

      // Send in-app notification alerts to all assignees
      if (task.assignees && task.assignees.length > 0) {
        for (const assigneeId of task.assignees) {
          if (assigneeId.toString() !== creatorId) {
            await notificationService.createNotification(
              assigneeId.toString(),
              projectId,
              'New Task Assigned',
              `You have been assigned the task: "${task.title}"`
            );
          }
        }
      }

      return task;
    });
  }

  async getTaskDetails(taskId: string): Promise<ITask> {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }
    return task;
  }

  async getProjectTasks(
    projectId: string,
    filters: TaskFilters,
    options: QueryOptions
  ): Promise<{ tasks: ITask[]; total: number }> {
    return taskRepository.findAll(projectId, filters, options);
  }

  async updateTask(taskId: string, taskData: Partial<ITask>, updaterId: string): Promise<ITask> {
    return logger.profile('TaskService.updateTask', async () => {
      const existingTask = await taskRepository.findById(taskId);
      if (!existingTask) {
        throw new NotFoundError('Task not found.');
      }

      const projectId = existingTask.projectId.toString();
      const updaterRole = await projectRepository.getUserRoleInProject(projectId, updaterId);
      this.assertCanUpdateTask(updaterRole, existingTask, updaterId);

      const expectedVersion = (taskData as any).version;
      delete (taskData as any).version;

      const updatePayload = {
        ...taskData,
        updatedBy: updaterId as any,
      };

      const task = typeof expectedVersion === 'number'
        ? await taskRepository.updateWithVersion(taskId, expectedVersion, updatePayload)
        : await taskRepository.update(taskId, updatePayload);

      if (!task) {
        throw new ConflictError('Task was updated by another user. Please reload the latest version before saving.');
      }

      // Clear cached analytics
      await cacheService.del(this.getAnalyticsCacheKey(projectId));

      // Log activity
      await activityRepository.log(projectId, updaterId, 'task:update', `Updated task "${task.title}"`);

      // Broadcast Socket update event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_UPDATED, {
        task,
        actor: updaterId,
      });

      // Send alert notifications if assignee list changed
      const oldAssignees = existingTask.assignees.map(id => id._id.toString());
      const newAssignees = task.assignees.map(id => id._id.toString());

      const addedAssignees = newAssignees.filter(id => !oldAssignees.includes(id));
      for (const assigneeId of addedAssignees) {
        if (assigneeId !== updaterId) {
          await notificationService.createNotification(
            assigneeId,
            projectId,
            'Task Assigned',
            `You have been assigned to: "${task.title}"`
          );
        }
      }

      return task;
    });
  }

  async deleteTask(taskId: string, deleterId: string): Promise<void> {
    return logger.profile('TaskService.deleteTask', async () => {
      const task = await taskRepository.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      const projectId = task.projectId.toString();

      // Clean up attachment storage files
      if (task.attachments && task.attachments.length > 0) {
        for (const attachment of task.attachments) {
          await uploadService.deleteFile(attachment.url);
        }
      }

      await taskRepository.delete(taskId);

      // Clear cached analytics
      await cacheService.del(this.getAnalyticsCacheKey(projectId));

      // Log activity
      await activityRepository.log(projectId, deleterId, 'task:delete', `Deleted task "${task.title}"`);

      // Broadcast Socket deleted event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_DELETED, {
        taskId,
        actor: deleterId,
      });
    });
  }

  // BULK OPERATIONS
  async bulkUpdateStatus(projectId: string, taskIds: string[], status: string, actorId: string): Promise<number> {
    return logger.profile('TaskService.bulkUpdateStatus', async () => {
      const modifiedCount = await taskRepository.bulkUpdateStatus(projectId, taskIds, status, actorId);
      
      // Invalidate caches
      await cacheService.del(this.getAnalyticsCacheKey(projectId));

      // Log activity
      await activityRepository.log(projectId, actorId, 'task:bulk_update_status', `Bulk updated status of ${modifiedCount} tasks to "${status}"`);

      // Broadcast Socket update event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_BULK_UPDATED, {
        taskIds,
        projectId,
        action: 'status',
        value: status,
        actor: actorId,
      });

      return modifiedCount;
    });
  }

  async bulkAssign(projectId: string, taskIds: string[], assigneeIds: string[], actorId: string): Promise<number> {
    return logger.profile('TaskService.bulkAssign', async () => {
      const modifiedCount = await taskRepository.bulkAssign(projectId, taskIds, assigneeIds, actorId);

      // Invalidate caches
      await cacheService.del(this.getAnalyticsCacheKey(projectId));

      // Log activity
      await activityRepository.log(projectId, actorId, 'task:bulk_assign', `Bulk updated assignees of ${modifiedCount} tasks`);

      // Broadcast Socket update event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_BULK_UPDATED, {
        taskIds,
        projectId,
        action: 'assign',
        value: assigneeIds,
        actor: actorId,
      });

      return modifiedCount;
    });
  }

  async bulkDelete(projectId: string, taskIds: string[], actorId: string): Promise<number> {
    return logger.profile('TaskService.bulkDelete', async () => {
      // Find all tasks to delete attachments
      const TaskModel = require('../models/Task').Task;
      const tasks = await TaskModel.find({ _id: { $in: taskIds }, projectId });
      
      for (const task of tasks) {
        if (task.attachments && task.attachments.length > 0) {
          for (const attachment of task.attachments) {
            await uploadService.deleteFile(attachment.url);
          }
        }
      }

      const deletedCount = await taskRepository.bulkDelete(projectId, taskIds);

      // Invalidate caches
      await cacheService.del(this.getAnalyticsCacheKey(projectId));

      // Log activity
      await activityRepository.log(projectId, actorId, 'task:bulk_delete', `Bulk deleted ${deletedCount} tasks`);

      // Broadcast Socket delete event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_BULK_UPDATED, {
        taskIds,
        projectId,
        action: 'delete',
        actor: actorId,
      });

      return deletedCount;
    });
  }

  // ATTACHMENTS
  async addAttachment(taskId: string, file: Express.Multer.File, userId: string): Promise<ITask> {
    return logger.profile('TaskService.addAttachment', async () => {
      const task = await taskRepository.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      const uploadResult = await uploadService.uploadFile(file);
      
      const attachment: Partial<IAttachment> = {
        name: uploadResult.name,
        url: uploadResult.url,
        type: uploadResult.type,
        size: uploadResult.size,
        uploadedBy: userId as any,
      };

      const updatedTask = await taskRepository.addAttachment(taskId, attachment);
      if (!updatedTask) {
        throw new BadRequestError('Failed to add attachment.');
      }

      const projectId = updatedTask.projectId.toString();

      // Log activity
      await activityRepository.log(projectId, userId, 'task:attachment_add', `Added file "${uploadResult.name}" to task "${updatedTask.title}"`);

      // Broadcast Socket update event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: userId,
      });

      return updatedTask;
    });
  }

  async removeAttachment(taskId: string, attachmentId: string, userId: string): Promise<ITask> {
    return logger.profile('TaskService.removeAttachment', async () => {
      const task = await taskRepository.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      const attachment = task.attachments.find(a => a._id.toString() === attachmentId);
      if (!attachment) {
        throw new NotFoundError('Attachment not found.');
      }

      // Delete physical file from Cloudinary / local storage
      await uploadService.deleteFile(attachment.url);

      const updatedTask = await taskRepository.removeAttachment(taskId, attachmentId);
      if (!updatedTask) {
        throw new BadRequestError('Failed to remove attachment.');
      }

      const projectId = updatedTask.projectId.toString();

      // Log activity
      await activityRepository.log(projectId, userId, 'task:attachment_remove', `Removed file "${attachment.name}" from task "${updatedTask.title}"`);

      // Broadcast Socket update event
      socketService.toRoom(projectId, SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: userId,
      });

      return updatedTask;
    });
  }

  async getAttachment(taskId: string, attachmentId: string): Promise<IAttachment> {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const attachment = task.attachments.find(a => a._id.toString() === attachmentId);
    if (!attachment) {
      throw new NotFoundError('Attachment not found.');
    }

    return attachment;
  }

  // ANALYTICS (CACHED)
  async getAnalytics(projectId: string): Promise<any> {
    return logger.profile('TaskService.getAnalytics', async () => {
      const cacheKey = this.getAnalyticsCacheKey(projectId);
      
      // Try retrieving from cache
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const TaskModel = require('../models/Task').Task;
      const [statusAgg, priorityAgg, totalTasks] = await Promise.all([
        TaskModel.aggregate([
          { $match: { projectId: new Types.ObjectId(projectId) } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        TaskModel.aggregate([
          { $match: { projectId: new Types.ObjectId(projectId) } },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        TaskModel.countDocuments({ projectId }),
      ]);

      const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
      const priorityCounts = { low: 0, medium: 0, high: 0, critical: 0 };

      for (const item of statusAgg) {
        if (Object.prototype.hasOwnProperty.call(statusCounts, item._id)) {
          statusCounts[item._id as keyof typeof statusCounts] = item.count;
        }
      }

      for (const item of priorityAgg) {
        if (Object.prototype.hasOwnProperty.call(priorityCounts, item._id)) {
          priorityCounts[item._id as keyof typeof priorityCounts] = item.count;
        }
      }

      const analytics = {
        projectId,
        totalTasks,
        statusCounts,
        priorityCounts,
        completionRate: totalTasks > 0 ? Math.round((statusCounts.done / totalTasks) * 100) : 0,
      };

      // Save analytics in cache for 15 minutes
      await cacheService.set(cacheKey, analytics, 900);

      return analytics;
    });
  }

  async addComment(taskId: string, text: string, authorId: string): Promise<ITask> {
    return logger.profile('TaskService.addComment', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      task.comments.push({
        text,
        author: authorId as any,
        createdAt: new Date(),
      } as any);

      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: authorId,
      });

      return updatedTask;
    });
  }

  async deleteComment(taskId: string, commentId: string, actorId: string): Promise<ITask> {
    return logger.profile('TaskService.deleteComment', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      const commentIndex = task.comments.findIndex(c => c._id.toString() === commentId);
      if (commentIndex === -1) {
        throw new NotFoundError('Comment not found.');
      }

      task.comments.splice(commentIndex, 1);
      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: actorId,
      });

      return updatedTask;
    });
  }

  async startTimer(taskId: string, actorId: string): Promise<ITask> {
    return logger.profile('TaskService.startTimer', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      if (task.timerStartedAt) {
        throw new BadRequestError('Timer is already running on this task.');
      }

      task.timerStartedAt = new Date();
      task.pausedSeconds = 0;
      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: actorId,
      });

      // Send real-time notification alerts to all other assignees
      if (updatedTask.assignees && updatedTask.assignees.length > 0) {
        for (const assignee of updatedTask.assignees) {
          const assigneeId = (assignee as any)._id ? (assignee as any)._id.toString() : assignee.toString();
          if (assigneeId !== actorId) {
            await notificationService.createNotification(
              assigneeId,
              updatedTask.projectId.toString(),
              'Timer Started',
              `A timer was started on your task: "${updatedTask.title}"`
            );
          }
        }
      }

      return updatedTask;
    });
  }

  async pauseTimer(taskId: string, actorId: string): Promise<ITask> {
    return logger.profile('TaskService.pauseTimer', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      if (!task.timerStartedAt) {
        throw new BadRequestError('Timer is not running on this task.');
      }

      const elapsedSeconds = Math.round((new Date().getTime() - task.timerStartedAt.getTime()) / 1000);
      task.pausedSeconds = (task.pausedSeconds || 0) + elapsedSeconds;
      task.timerStartedAt = undefined;
      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: actorId,
      });

      // Send real-time notification alerts to all other assignees
      if (updatedTask.assignees && updatedTask.assignees.length > 0) {
        for (const assignee of updatedTask.assignees) {
          const assigneeId = (assignee as any)._id ? (assignee as any)._id.toString() : assignee.toString();
          if (assigneeId !== actorId) {
            await notificationService.createNotification(
              assigneeId,
              updatedTask.projectId.toString(),
              'Timer Paused',
              `The timer was paused on your task: "${updatedTask.title}"`
            );
          }
        }
      }

      return updatedTask;
    });
  }

  async resumeTimer(taskId: string, actorId: string): Promise<ITask> {
    return logger.profile('TaskService.resumeTimer', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      if (task.timerStartedAt) {
        throw new BadRequestError('Timer is already running on this task.');
      }

      task.timerStartedAt = new Date();
      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: actorId,
      });

      // Send real-time notification alerts to all other assignees
      if (updatedTask.assignees && updatedTask.assignees.length > 0) {
        for (const assignee of updatedTask.assignees) {
          const assigneeId = (assignee as any)._id ? (assignee as any)._id.toString() : assignee.toString();
          if (assigneeId !== actorId) {
            await notificationService.createNotification(
              assigneeId,
              updatedTask.projectId.toString(),
              'Timer Resumed',
              `The timer was resumed on your task: "${updatedTask.title}"`
            );
          }
        }
      }

      return updatedTask;
    });
  }

  async stopTimer(taskId: string, actorId: string): Promise<ITask> {
    return logger.profile('TaskService.stopTimer', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      task.timerStartedAt = undefined;
      task.pausedSeconds = 0;
      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: actorId,
      });

      // Send real-time notification alerts to all other assignees
      if (updatedTask.assignees && updatedTask.assignees.length > 0) {
        for (const assignee of updatedTask.assignees) {
          const assigneeId = (assignee as any)._id ? (assignee as any)._id.toString() : assignee.toString();
          if (assigneeId !== actorId) {
            await notificationService.createNotification(
              assigneeId,
              updatedTask.projectId.toString(),
              'Timer Stopped',
              `The timer was stopped on your task: "${updatedTask.title}"`
            );
          }
        }
      }

      return updatedTask;
    });
  }

  async finishTimer(taskId: string, actorId: string): Promise<ITask> {
    return logger.profile('TaskService.finishTimer', async () => {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new NotFoundError('Task not found.');
      }

      let elapsedSeconds = 0;
      if (task.timerStartedAt) {
        elapsedSeconds = Math.round((new Date().getTime() - task.timerStartedAt.getTime()) / 1000);
      }

      task.timeSpent = (task.timeSpent || 0) + (task.pausedSeconds || 0) + elapsedSeconds;
      task.timerStartedAt = undefined;
      task.pausedSeconds = 0;
      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('comments.author', 'name email');

      if (!updatedTask) {
        throw new NotFoundError('Task not found after update.');
      }

      // Broadcast Socket update event
      socketService.toRoom(updatedTask.projectId.toString(), SOCKET_EVENTS.TASK_UPDATED, {
        task: updatedTask,
        actor: actorId,
      });

      // Send real-time notification alerts to all other assignees
      if (updatedTask.assignees && updatedTask.assignees.length > 0) {
        for (const assignee of updatedTask.assignees) {
          const assigneeId = (assignee as any)._id ? (assignee as any)._id.toString() : assignee.toString();
          if (assigneeId !== actorId) {
            await notificationService.createNotification(
              assigneeId,
              updatedTask.projectId.toString(),
              'Timer Finished',
              `The timer was completed/finished on your task: "${updatedTask.title}"`
            );
          }
        }
      }

      return updatedTask;
    });
  }

  async checkDueDates(): Promise<void> {
    return logger.profile('TaskService.checkDueDates', async () => {
      // Find all active, incomplete tasks due in the next 24 hours that haven't been notified yet
      const arrivingLimit = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const tasks = await Task.find({
        status: { $ne: 'done' },
        dueDate: { $gte: new Date(), $lte: arrivingLimit },
        dueDateNotified: { $ne: true },
      });

      for (const task of tasks) {
        if (task.assignees && task.assignees.length > 0) {
          for (const assigneeId of task.assignees) {
            await notificationService.createNotification(
              assigneeId.toString(),
              task.projectId.toString(),
              'Task Due Soon',
              `The task "${task.title}" is due soon (on ${task.dueDate?.toLocaleDateString()})`
            );
          }
        }
        // Mark as notified
        task.dueDateNotified = true;
        await task.save();
      }
    });
  }

  private assertCanCreateTask(role: Role | null, taskData: Partial<ITask>, userId: string): void {
    if (role === 'admin' || role === 'manager') return;

    if (role === 'member') {
      const assignees = (taskData.assignees || []).map(id => id.toString());
      if (assignees.includes(userId)) return;
      throw new BadRequestError('Team members can only create tasks assigned to themselves.');
    }

    throw new BadRequestError('Insufficient permissions to create a task.');
  }

  private assertCanUpdateTask(role: Role | null, task: ITask, userId: string): void {
    if (role === 'admin' || role === 'manager') return;

    if (role === 'member') {
      const isAssigned = task.assignees.some(assignee => {
        const id = (assignee as any)._id || assignee;
        return id.toString() === userId;
      });

      if (isAssigned) return;
      throw new BadRequestError('Team members can only edit tasks assigned to them.');
    }

    throw new BadRequestError('Insufficient permissions to update this task.');
  }
}

export const taskService = new TaskService();
export default taskService;
