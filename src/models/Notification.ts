import { Schema, model, type Document, type Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  projectId?: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Quick access to user notifications
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true, // Retrieve unread notifications fast
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for user unread listings sorted by timestamp
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
export default Notification;
