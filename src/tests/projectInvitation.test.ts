import { projectService } from '../services/project.service';
import { ProjectInvitation } from '../models/ProjectInvitation';
import { Project } from '../models/Project';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

jest.mock('../models/ProjectInvitation');
jest.mock('../models/Project');
jest.mock('../models/User');
jest.mock('../config/mail');
jest.mock('../config/redis');
jest.mock('../models/ActivityLog');
jest.mock('../models/Notification');

describe('Project Invitation Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processPendingInvitations', () => {
    it('should automatically join a user to projects they have pending invitations for', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const mockProjectId = '507f1f77bcf86cd799439022';
      const mockUserEmail = 'collaborator@webbingo.com';

      // 1. Mock finding user
      const mockUser = {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Collaborator',
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // 2. Mock finding pending invitations
      const mockInvitation = {
        id: 'invite-123',
        projectId: mockProjectId,
        email: mockUserEmail,
        role: 'member',
        status: 'pending',
      };
      (ProjectInvitation.find as jest.Mock).mockResolvedValue([mockInvitation]);

      // 3. Mock Project find to verify it still exists
      const mockProject = {
        _id: mockProjectId,
        name: 'layout design',
        members: [{ user: '507f1f77bcf86cd799439099', role: 'admin' }],
      };
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      // 4. Mock checking if already member (isUserMember checks countDocuments)
      (Project.countDocuments as jest.Mock).mockResolvedValue(0);

      // 5. Mock adding user to project members
      (Project.findByIdAndUpdate as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockProject),
      });

      // 6. Mock updating invitation status
      (ProjectInvitation.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockInvitation,
        status: 'accepted',
      });

      // Execute method
      await projectService.processPendingInvitations(mockUserId);

      // Verify that user is added and invite is marked accepted
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(ProjectInvitation.find).toHaveBeenCalledWith({ email: mockUserEmail, status: 'pending' });
      expect(Project.findById).toHaveBeenCalledWith(mockProjectId);
      expect(ProjectInvitation.findByIdAndUpdate).toHaveBeenCalledWith('invite-123', { $set: { status: 'accepted' } }, { new: true });
    });
  });

  describe('inviteMember', () => {
    it('should send a real-time notification if the invited user is already registered', async () => {
      const mockProjectId = '507f1f77bcf86cd799439022';
      const mockInviterId = '507f1f77bcf86cd799439011';
      const mockUserEmail = 'registered@webbingo.com';

      // Mock finding project
      const mockProject = {
        id: mockProjectId,
        name: 'layout design',
      };
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      // Mock checking role of inviter
      const mockRoleQuery = {
        lean: jest.fn().mockResolvedValue({ members: [{ role: 'admin' }] }),
      };
      (Project.findOne as jest.Mock).mockReturnValue(mockRoleQuery);

      // Mock finding existing user
      const mockExistingUser = {
        id: '507f1f77bcf86cd799439088',
        email: mockUserEmail,
        name: 'Existing User',
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockExistingUser);

      // Mock checking if user is member
      (Project.countDocuments as jest.Mock).mockResolvedValue(0);

      // Mock creating invitation
      const mockInvitation = {
        save: jest.fn().mockResolvedValue({}),
      };
      (ProjectInvitation as any).mockImplementation(() => mockInvitation);

      // Mock Notification create & save
      const mockNotification = {
        save: jest.fn().mockResolvedValue({}),
      };
      const NotificationModel = require('../models/Notification').Notification;
      (NotificationModel as any).mockImplementation(() => mockNotification);

      // Mock projectInvitationRepository.deletePendingByEmailAndProject
      (ProjectInvitation.deleteMany as jest.Mock).mockResolvedValue({});

      // Execute method
      await projectService.inviteMember(mockProjectId, mockUserEmail, 'member', mockInviterId);

      // Verify that notification model was initialized (meaning notification was created)
      expect(NotificationModel).toHaveBeenCalled();
    });
  });
});
