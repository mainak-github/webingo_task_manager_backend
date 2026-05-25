import { Schema, model, type Document, type Types } from 'mongoose';
import type { TaskStatus } from '../constants/taskStatus';
import { TASK_STATUS_VALUES } from '../constants/taskStatus';

export interface IAttachment {
  _id: Types.ObjectId;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: Types.ObjectId;
}

export interface IComment {
  _id: Types.ObjectId;
  text: string;
  author: Types.ObjectId;
  createdAt: Date;
}

export interface ITask extends Document {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignees: Types.ObjectId[];
  dueDate?: Date;
  dueDateNotified?: boolean;
  projectId: Types.ObjectId;
  attachments: IAttachment[];
  isMarketplaceIntegrated?: boolean;
  marketplaceType?: 'none' | 'stripe' | 'shopify' | 'amazon' | 'custom';
  integrationDetails?: string;
  progress: number;
  timeSpent: number;
  timerStartedAt?: Date;
  pausedSeconds: number;
  comments: IComment[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

const TaskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [150, 'Task title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: TASK_STATUS_VALUES,
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    assignees: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    dueDate: {
      type: Date,
    },
    dueDateNotified: {
      type: Boolean,
      default: false,
    },
    isMarketplaceIntegrated: {
      type: Boolean,
      default: false,
    },
    marketplaceType: {
      type: String,
      enum: ['none', 'stripe', 'shopify', 'amazon', 'custom'],
      default: 'none',
    },
    integrationDetails: {
      type: String,
      trim: true,
      maxlength: [1000, 'Integration details cannot exceed 1000 characters'],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    attachments: [AttachmentSchema],
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    timeSpent: {
      type: Number,
      default: 0,
    },
    timerStartedAt: {
      type: Date,
    },
    pausedSeconds: {
      type: Number,
      default: 0,
    },
    comments: [
      {
        text: { type: String, required: true },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for filtering tasks in Kanban boards efficiently
TaskSchema.index({ projectId: 1, status: 1, priority: 1 });
TaskSchema.index({ projectId: 1, dueDate: 1 });

export const Task = model<ITask>('Task', TaskSchema);
export default Task;
