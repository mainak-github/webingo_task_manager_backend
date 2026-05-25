import { Notification, type INotification } from '../models/Notification';
import { socketService } from './socket.service';
import { SOCKET_EVENTS } from '../constants/events';
import { logger } from '../utils/logger';

export class NotificationService {
  async createNotification(
    userId: string,
    projectId: string | undefined,
    title: string,
    message: string
  ): Promise<INotification> {
    return logger.profile('NotificationService.createNotification', async () => {
      const notification = new Notification({
        userId,
        projectId,
        title,
        message,
        isRead: false,
      });

      await notification.save();

      // Dispatch live Socket.io alert to the user's personal channel
      socketService.toUser(userId, SOCKET_EVENTS.NOTIFICATION_RECEIVED, {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
      });

      return notification;
    });
  }

  async getUserNotifications(userId: string): Promise<INotification[]> {
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return notifications as unknown as INotification[];
  }

  async markAsRead(id: string): Promise<INotification | null> {
    return Notification.findByIdAndUpdate(id, { $set: { isRead: true } }, { new: true });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
    return result.modifiedCount;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
