import { Schema, model, type Document, type Types } from 'mongoose';
import type { Role } from '../constants/roles';
import { ROLE_VALUES } from '../constants/roles';

export interface IProjectInvitation extends Document {
  projectId: Types.ObjectId;
  email: string;
  role: Role;
  invitedBy: Types.ObjectId;
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

const ProjectInvitationSchema = new Schema<IProjectInvitation>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find pending invitations for an email in a project
ProjectInvitationSchema.index({ email: 1, projectId: 1, status: 1 });

export const ProjectInvitation = model<IProjectInvitation>('ProjectInvitation', ProjectInvitationSchema);
export default ProjectInvitation;
