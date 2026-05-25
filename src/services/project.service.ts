import { projectRepository } from '../repositories/project.repository';
import { userRepository } from '../repositories/user.repository';
import { activityRepository } from '../repositories/activity.repository';
import { projectInvitationRepository } from '../repositories/projectInvitation.repository';
import { notificationService } from './notification.service';
import { mailService } from '../config/mail';
import { cacheService } from '../config/redis';
import { BadRequestError } from '../errors/BadRequestError';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { IProject } from '../models/Project';
import type { Role } from '../constants/roles';
import { Task } from '../models/Task';
import { ActivityLog } from '../models/ActivityLog';
import { Notification } from '../models/Notification';
import { buildClientUrl, escapeHtml } from '../utils/clientUrl';

export class ProjectService {
  private getProjectsCacheKey(userId: string): string {
    return `user:${userId}:projects`;
  }

  async createProject(projectData: Partial<IProject>, ownerId: string): Promise<IProject> {
    return logger.profile('ProjectService.createProject', async () => {
      const project = await projectRepository.create({
        ...projectData,
        status: 'active',
        members: [{ user: ownerId as any, role: 'admin' }],
      });

      // Clear cached project list for owner
      await cacheService.del(this.getProjectsCacheKey(ownerId));

      // Log project creation activity
      await activityRepository.log(project.id, ownerId, 'project:create', `Created project "${project.name}"`);

      return project;
    });
  }

  async getProjectDetails(projectId: string): Promise<IProject> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }
    return project;
  }

  async processPendingInvitations(userId: string): Promise<void> {
    return logger.profile('ProjectService.processPendingInvitations', async () => {
      const user = await userRepository.findById(userId);
      if (!user) return;

      const pendingInvitations = await projectInvitationRepository.findPendingByEmail(user.email);
      if (pendingInvitations.length === 0) return;

      for (const invitation of pendingInvitations) {
        const projectIdStr = invitation.projectId.toString();

        // Verify if project still exists
        const project = await projectRepository.findById(projectIdStr, false);
        if (!project) {
          await projectInvitationRepository.updateStatus(invitation.id, 'declined');
          continue;
        }

        // Check if user is already a member
        const isMember = await projectRepository.isUserMember(projectIdStr, userId);
        if (!isMember) {
          // Add user to project
          const updatedProject = await projectRepository.addMember(projectIdStr, userId, invitation.role);
          if (updatedProject) {
            // Invalidate cache for all members
            await cacheService.del(this.getProjectsCacheKey(userId));
            for (const member of updatedProject.members) {
              const memberId = (member.user as any)._id ? (member.user as any)._id.toString() : member.user.toString();
              await cacheService.del(this.getProjectsCacheKey(memberId));
            }
            await cacheService.del(`project:${projectIdStr}:analytics`);

            // Log activity and notify admin
            await activityRepository.log(projectIdStr, userId, 'member:join', `Joined project via linked email invitation`);
            
            const adminMember = updatedProject.members.find(m => m.role === 'admin');
            if (adminMember) {
              const adminId = (adminMember.user as any)._id ? (adminMember.user as any)._id.toString() : adminMember.user.toString();
              await notificationService.createNotification(
                adminId,
                projectIdStr,
                'Member Joined',
                `${user.name} joined project "${updatedProject.name}"`
              );
            }
          }
        }

        // Mark the invitation as accepted
        await projectInvitationRepository.updateStatus(invitation.id, 'accepted');
      }
    });
  }

  async getUserProjects(userId: string): Promise<IProject[]> {
    return logger.profile('ProjectService.getUserProjects', async () => {
      await this.processPendingInvitations(userId);
      return projectRepository.findUserProjects(userId);
    });
  }

  async inviteMember(projectId: string, email: string, role: Role, inviterId: string): Promise<string> {
    return logger.profile('ProjectService.inviteMember', async () => {
      const normalizedEmail = email.trim().toLowerCase();
      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      if (role === 'admin') {
        throw new BadRequestError('Project admin access must be granted from member management after the user has joined.');
      }

      const inviterRole = await projectRepository.getUserRoleInProject(projectId, inviterId);
      if (inviterRole !== 'admin' && role !== 'member' && role !== 'viewer') {
        throw new BadRequestError('Only project admins can invite managers.');
      }

      const existingUser = await userRepository.findByEmail(normalizedEmail);
      if (existingUser) {
        const isExistingMember = await projectRepository.isUserMember(projectId, existingUser.id);
        if (isExistingMember) {
          throw new BadRequestError('This user is already a member of the project.');
        }
      }

      // Generate signed JWT token for invitation (24-hour expiration)
      const tokenPayload = { projectId, email: normalizedEmail, role };
      const token = jwt.sign(tokenPayload, env.jwtAccessSecret, { expiresIn: '24h' });
      const invitationLink = buildClientUrl('/join-project', { token });
      const safeProjectName = escapeHtml(project.name);
      const safeRole = escapeHtml(role);

      // Save invitation in database
      await projectInvitationRepository.deletePendingByEmailAndProject(normalizedEmail, projectId);
      await projectInvitationRepository.create({
        projectId: projectId as any,
        email: normalizedEmail,
        role,
        invitedBy: inviterId as any,
        token,
        status: 'pending',
      });

      // Send real-time notification to the invited user if they already have a registered account
      if (existingUser) {
        const existingUserId = (existingUser as any)._id ? (existingUser as any)._id.toString() : ((existingUser as any).id || existingUser.toString());
        await notificationService.createNotification(
          existingUserId,
          projectId,
          'Project Invitation',
          `You have been invited to join project "${project.name}" as a ${role}`
        );
      }

      // Send mail
      await mailService.sendMail({
        to: normalizedEmail,
        subject: `Invitation to Join Project "${project.name}"`,
        html: `
          <h1>Project Invitation</h1>
          <p>You have been invited to join the project <strong>"${safeProjectName}"</strong> as a <strong>${safeRole}</strong>.</p>
          <p>Please click the link below to accept the invitation and join the workspace:</p>
          <a href="${invitationLink}">${invitationLink}</a>
        `,
      });

      // Log activity
      await activityRepository.log(projectId, inviterId, 'member:invite', `Invited "${normalizedEmail}" to project as ${role}`);

      return token;
    });
  }

  async validateInvitationToken(token: string): Promise<{ projectId: string; email: string; role: string }> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.jwtAccessSecret);
    } catch (err) {
      throw new BadRequestError('Invitation token is invalid or has expired.');
    }

    const { projectId, email, role } = decoded;
    const project = await projectRepository.findById(projectId, false);
    if (!project) {
      throw new NotFoundError('Project no longer exists.');
    }

    return { projectId, email, role };
  }

  async joinProjectViaToken(token: string, userId: string): Promise<IProject> {
    return logger.profile('ProjectService.joinProjectViaToken', async () => {
      let decoded: any;
      try {
        decoded = jwt.verify(token, env.jwtAccessSecret);
      } catch (err) {
        throw new BadRequestError('Invitation token is invalid or has expired.');
      }

      const { projectId, email, role } = decoded;
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new NotFoundError('User profile not found.');
      }

      // Check if emails match (case insensitive) - strict enforcement
      if (user.email.toLowerCase() !== email.toLowerCase()) {
        throw new ForbiddenError(
          `This invitation was sent to ${email}. Please sign in with that email address, or ask the project admin to send a new invitation to your email.`
        );
      }

      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project no longer exists.');
      }

      // Check if user is already a member
      const isMember = await projectRepository.isUserMember(projectId, userId);
      if (isMember) {
        const invitation = await projectInvitationRepository.findPendingByEmailAndProject(email, projectId);
        if (invitation) {
          await projectInvitationRepository.updateStatus(invitation.id, 'accepted');
        }
        const existingProject = await projectRepository.findById(projectId);
        if (!existingProject) {
          throw new NotFoundError('Project no longer exists.');
        }
        return existingProject;
      }

      // Add user to project members
      const updatedProject = await projectRepository.addMember(projectId, userId, role);
      if (!updatedProject) {
        throw new BadRequestError('Failed to join project.');
      }

      // Update invitation status
      const invitation = await projectInvitationRepository.findPendingByEmailAndProject(email, projectId);
      if (invitation) {
        await projectInvitationRepository.updateStatus(invitation.id, 'accepted');
      }

      // Clear cache for new member
      await cacheService.del(this.getProjectsCacheKey(userId));
      // Invalidate cache for other members as well
      for (const member of updatedProject.members) {
        const memberId = (member.user as any)._id ? (member.user as any)._id.toString() : member.user.toString();
        await cacheService.del(this.getProjectsCacheKey(memberId));
      }

      // Invalidate analytics caches
      await cacheService.del(`project:${projectId}:analytics`);

      // Log activity and send notification to creator/admin
      await activityRepository.log(projectId, userId, 'member:join', `Joined project via email invitation`);
      
      const adminMember = updatedProject.members.find(m => m.role === 'admin');
      if (adminMember) {
        const adminId = (adminMember.user as any)._id ? (adminMember.user as any)._id.toString() : adminMember.user.toString();
        await notificationService.createNotification(
          adminId,
          projectId,
          'Member Joined',
          `${user.name} joined project "${updatedProject.name}"`
        );
      }

      return updatedProject;
    });
  }

  async removeMember(projectId: string, memberId: string, actorId: string): Promise<IProject> {
    return logger.profile('ProjectService.removeMember', async () => {
      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      // Prevent removing the sole project admin
      const memberToRemove = project.members.find(m => m.user.toString() === memberId);
      if (memberToRemove?.role === 'admin') {
        const adminCount = project.members.filter(m => m.role === 'admin').length;
        if (adminCount <= 1) {
          throw new BadRequestError('Cannot remove the last Project Admin.');
        }
      }

      const updatedProject = await projectRepository.removeMember(projectId, memberId);
      if (!updatedProject) {
        throw new BadRequestError('Failed to remove member.');
      }

      // Invalidate caches
      await cacheService.del(this.getProjectsCacheKey(memberId));
      for (const member of updatedProject.members) {
        await cacheService.del(this.getProjectsCacheKey(member.user.toString()));
      }
      await cacheService.del(`project:${projectId}:analytics`);

      // Log activity
      await activityRepository.log(projectId, actorId, 'member:remove', `Removed member ${memberId} from project`);

      // Send alert notification to the removed member
      await notificationService.createNotification(
        memberId,
        projectId,
        'Removed From Project',
        `You have been removed from the project "${project.name}"`
      );

      return updatedProject;
    });
  }

  async updateMemberRole(projectId: string, memberId: string, role: Role, actorId: string): Promise<IProject> {
    return logger.profile('ProjectService.updateMemberRole', async () => {
      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      const updatedProject = await projectRepository.updateMemberRole(projectId, memberId, role);
      if (!updatedProject) {
        throw new BadRequestError('Failed to update member role.');
      }

      // Invalidate caches
      await cacheService.del(this.getProjectsCacheKey(memberId));
      for (const member of updatedProject.members) {
        await cacheService.del(this.getProjectsCacheKey(member.user.toString()));
      }

      // Log activity
      await activityRepository.log(projectId, actorId, 'member:role_change', `Updated role of member ${memberId} to "${role}"`);

      // Send alert notification
      await notificationService.createNotification(
        memberId,
        projectId,
        'Role Updated',
        `Your role in project "${project.name}" has been updated to "${role}"`
      );

      return updatedProject;
    });
  }

  async updateProject(projectId: string, updateData: Partial<IProject>, actorId: string): Promise<IProject> {
    return logger.profile('ProjectService.updateProject', async () => {
      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      const updatedProject = await projectRepository.update(projectId, updateData);
      if (!updatedProject) {
        throw new BadRequestError('Failed to update project.');
      }

      // Invalidate cache for all members
      for (const member of updatedProject.members) {
        await cacheService.del(this.getProjectsCacheKey(member.user.toString()));
      }
      await cacheService.del(`project:${projectId}:analytics`);

      // Log activity
      await activityRepository.log(projectId, actorId, 'project:update', `Updated project workspace details`);

      return updatedProject;
    });
  }

  async deleteProject(projectId: string, actorId: string): Promise<void> {
    return logger.profile('ProjectService.deleteProject', async () => {
      const project = await projectRepository.findById(projectId, false);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      // Check if project has associated tasks
      const taskCount = await Task.countDocuments({ projectId });
      if (taskCount > 0) {
        throw new BadRequestError('Cannot delete project workspace because it has active task cards associated with it. Please delete or move all tasks first.');
      }

      // Cascade delete activity logs and notifications
      await ActivityLog.deleteMany({ projectId });
      await Notification.deleteMany({ projectId });

      // Delete project record
      await projectRepository.delete(projectId);

      // Invalidate caches
      for (const member of project.members) {
        await cacheService.del(this.getProjectsCacheKey(member.user.toString()));
      }
      await cacheService.del(`project:${projectId}:analytics`);
    });
  }

  async getProjectActivityLog(projectId: string, page = 1, limit = 20): Promise<{ logs: any[]; total: number }> {
    return activityRepository.findProjectActivities(projectId, page, limit);
  }
}

export const projectService = new ProjectService();
export default projectService;
