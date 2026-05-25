import { Schema, model, type Document } from 'mongoose';

export interface IMailJob extends Document {
  to: string;
  subject: string;
  html: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MailJobSchema = new Schema<IMailJob>(
  {
    to: {
      type: String,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    html: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying next available job efficiently
MailJobSchema.index({ status: 1, createdAt: 1 });

export const MailJob = model<IMailJob>('MailJob', MailJobSchema);
export default MailJob;
