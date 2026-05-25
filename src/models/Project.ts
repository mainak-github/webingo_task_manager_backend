import { Schema, model, type Document, type Types } from 'mongoose';
import type { Role } from '../constants/roles';
import { ROLE_VALUES } from '../constants/roles';

export interface IProjectMember {
  user: Types.ObjectId;
  role: Role;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  status: 'active' | 'archived';
  category?: string;
  deadline?: Date;
  budget?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  members: IProjectMember[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    deadline: {
      type: Date,
    },
    budget: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true, // Efficiently find all projects a user is in
        },
        role: {
          type: String,
          enum: ROLE_VALUES,
          default: 'member',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index to quick-check user + project membership together
ProjectSchema.index({ _id: 1, 'members.user': 1 });

export const Project = model<IProject>('Project', ProjectSchema);
export default Project;

