import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { taskService } from '../services/task.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequestError } from '../errors/BadRequestError';
import path from 'path';

export const createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const creatorId = req.user!.id;

  const task = await taskService.createTask(projectId, req.body, creatorId);
  res.status(201).json(new ApiResponse(201, task, 'Task created successfully.'));
});

export const getProjectTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  
  const filters = {
    status: req.query.status as string,
    priority: req.query.priority as string,
    assignee: req.query.assignee as string,
    search: req.query.search as string,
  };

  const options = {
    page: parseInt(req.query.page as string || '1', 10),
    limit: parseInt(req.query.limit as string || '50', 10),
    sortBy: req.query.sortBy as string,
    sortOrder: req.query.sortOrder as 'asc' | 'desc',
  };

  const { tasks, total } = await taskService.getProjectTasks(projectId, filters, options);
  res.status(200).json(new ApiResponse(200, { tasks, total, page: options.page, limit: options.limit }, 'Tasks fetched successfully.'));
});

export const getTaskDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const task = await taskService.getTaskDetails(taskId);
  res.status(200).json(new ApiResponse(200, task, 'Task details fetched successfully.'));
});

export const updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const updaterId = req.user!.id;

  const task = await taskService.updateTask(taskId, req.body, updaterId);
  res.status(200).json(new ApiResponse(200, task, 'Task updated successfully.'));
});

export const deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const deleterId = req.user!.id;

  await taskService.deleteTask(taskId, deleterId);
  res.status(200).json(new ApiResponse(200, null, 'Task deleted successfully.'));
});

// BULK OPERATIONS
export const bulkUpdateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { taskIds, status } = req.body;
  const actorId = req.user!.id;

  const count = await taskService.bulkUpdateStatus(projectId, taskIds, status, actorId);
  res.status(200).json(new ApiResponse(200, { count }, `Successfully bulk updated ${count} tasks to status: ${status}`));
});

export const bulkAssign = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { taskIds, assigneeIds } = req.body;
  const actorId = req.user!.id;

  const count = await taskService.bulkAssign(projectId, taskIds, assigneeIds, actorId);
  res.status(200).json(new ApiResponse(200, { count }, `Successfully bulk updated assignees of ${count} tasks.`));
});

export const bulkDelete = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { taskIds } = req.body;
  const actorId = req.user!.id;

  const count = await taskService.bulkDelete(projectId, taskIds, actorId);
  res.status(200).json(new ApiResponse(200, { count }, `Successfully bulk deleted ${count} tasks.`));
});

// FILE UPLOAD AND ATTACHMENTS
export const uploadAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  if (!req.file) {
    throw new BadRequestError('Please provide a file to upload.');
  }

  const task = await taskService.addAttachment(taskId, req.file, userId);
  res.status(200).json(new ApiResponse(200, task, 'Attachment uploaded and added successfully.'));
});

export const removeAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId, attachmentId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.removeAttachment(taskId, attachmentId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Attachment removed and deleted successfully.'));
});

export const downloadAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId, attachmentId } = req.params;
  const attachment = await taskService.getAttachment(taskId, attachmentId);

  if (attachment.url.includes('/uploads/')) {
    const filename = attachment.url.substring(attachment.url.lastIndexOf('/') + 1);
    const safeName = path.basename(filename);
    const filePath = path.join(__dirname, '../../uploads', safeName);
    return res.download(filePath, attachment.name);
  }

  return res.redirect(attachment.url);
});

// PROJECT ANALYTICS
export const getProjectAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const analytics = await taskService.getAnalytics(projectId);
  res.status(200).json(new ApiResponse(200, analytics, 'Project analytics fetched successfully.'));
});

export const addComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const { text } = req.body;
  const userId = req.user!.id;

  if (!text || !text.trim()) {
    throw new BadRequestError('Comment text is required.');
  }

  const task = await taskService.addComment(taskId, text, userId);
  res.status(201).json(new ApiResponse(201, task, 'Comment added successfully.'));
});

export const deleteComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId, commentId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.deleteComment(taskId, commentId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Comment deleted successfully.'));
});

export const startTimer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.startTimer(taskId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Timer started successfully.'));
});

export const pauseTimer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.pauseTimer(taskId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Timer paused successfully.'));
});

export const resumeTimer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.resumeTimer(taskId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Timer resumed successfully.'));
});

export const stopTimer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.stopTimer(taskId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Timer stopped successfully.'));
});

export const finishTimer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  const task = await taskService.finishTimer(taskId, userId);
  res.status(200).json(new ApiResponse(200, task, 'Timer finished successfully.'));
});
