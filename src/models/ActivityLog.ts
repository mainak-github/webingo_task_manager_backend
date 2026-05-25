import { Schema, model, type Document, type Types } from 'mongoose';

export interface IActivityLog extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  action: string;
  details: string;
  timestamp: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use custom timestamp field
  }
);

// Compound index to quickly fetch reverse chronological activity within a project
ActivityLogSchema.index({ projectId: 1, timestamp: -1 });

export const ActivityLog = model<IActivityLog>('ActivityLog', ActivityLogSchema);
export default ActivityLog;
