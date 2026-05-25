import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const getUserNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const notifications = await notificationService.getUserNotifications(userId);
  res.status(200).json(new ApiResponse(200, notifications, 'Notifications fetched successfully.'));
});

export const markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const notification = await notificationService.markAsRead(id);
  res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read.'));
});

export const markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const count = await notificationService.markAllAsRead(userId);
  res.status(200).json(new ApiResponse(200, { count }, 'All notifications marked as read.'));
});
