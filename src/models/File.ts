import { Schema, model, type Document, type Types } from 'mongoose';

export interface IFile extends Document {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId?: Types.ObjectId;
  createdAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const File = model<IFile>('File', FileSchema);
export default File;
