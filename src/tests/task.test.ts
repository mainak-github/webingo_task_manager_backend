import request from 'supertest';
import { app } from '../app';
import { Task } from '../models/Task';
import { Project } from '../models/Project';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

jest.mock('../models/Task');
jest.mock('../models/Project');
jest.mock('../models/User');
jest.mock('../models/ActivityLog');
jest.mock('../models/Notification');

describe('Task Management API Endpoint Tests', () => {
  let mockToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Generate valid test JWT token using valid 24-char hex IDs
    mockToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'member' },
      'test_access_key'
    );

    // Mock userRepository.findById
    (User.findById as jest.Mock).mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      name: 'Rick B',
      email: 'rick@webbingo.com',
      role: 'member',
    });
  });

  describe('POST /api/tasks/:projectId/tasks', () => {
    it('should create a task successfully if user has project permissions', async () => {
      const taskData = {
        title: 'Complete assignment',
        description: 'Build real-time board features',
        priority: 'high',
        status: 'todo',
      };

      // Mock Project find to confirm existence & membership
      (Project.findById as jest.Mock).mockResolvedValue({
        id: '507f1f77bcf86cd799439022',
        name: 'Bingo Platform',
      });
      const mockProjectQuery = {
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve({
            members: [{ user: '507f1f77bcf86cd799439011', role: 'admin' }],
          }).then(callback);
        }),
      };
      (Project.findOne as jest.Mock).mockReturnValue(mockProjectQuery);

      // Mock save operation
      const mockSave = jest.fn().mockResolvedValue({
        id: '507f1f77bcf86cd799439033',
        projectId: '507f1f77bcf86cd799439022',
        ...taskData,
      });
      (Task as any).mockImplementation(() => ({
        save: mockSave,
        ...taskData,
      }));

      const response = await request(app)
        .post('/api/tasks/507f1f77bcf86cd799439022/tasks')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
    });

    it('should fail with 403 Forbidden if user is not a member of the project', async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        id: '507f1f77bcf86cd799439022',
        name: 'Bingo Platform',
      });
      const mockProjectQuery = {
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(null).then(callback);
        }),
      };
      (Project.findOne as jest.Mock).mockReturnValue(mockProjectQuery);

      const response = await request(app)
        .post('/api/tasks/507f1f77bcf86cd799439022/tasks')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          title: 'Complete assignment',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access Denied');
    });
  });

  describe('PATCH /api/tasks/tasks/:taskId', () => {
    it('should update a task successfully if user has project permissions', async () => {
      const updateData = {
        title: 'Updated title',
        status: 'in_progress',
      };

      // Mock Task findById for role middleware
      const mockTask = {
        _id: '507f1f77bcf86cd799439033',
        id: '507f1f77bcf86cd799439033',
        projectId: '507f1f77bcf86cd799439022',
        title: 'Complete assignment',
        status: 'todo',
        priority: 'high',
        assignees: [{ _id: '507f1f77bcf86cd799439011' }],
        populate: jest.fn().mockReturnThis(),
      };
      (Task.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(mockTask).then(callback);
        }),
      });

      // Mock project findOne for membership checking
      const mockProjectQuery = {
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve({
            members: [{ user: '507f1f77bcf86cd799439011', role: 'member' }],
          }).then(callback);
        }),
      };
      (Project.findOne as jest.Mock).mockReturnValue(mockProjectQuery);

      // Mock update operation
      const mockUpdatedTask = {
        ...mockTask,
        ...updateData,
      };
      (Task.findByIdAndUpdate as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(mockUpdatedTask).then(callback);
        }),
      });

      const response = await request(app)
        .patch('/api/tasks/tasks/507f1f77bcf86cd799439033')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.status).toBe(updateData.status);
    });
  });

  describe('DELETE /api/tasks/tasks/:taskId', () => {
    it('should delete a task successfully if user is admin or manager', async () => {
      const mockTask = {
        _id: '507f1f77bcf86cd799439033',
        id: '507f1f77bcf86cd799439033',
        projectId: '507f1f77bcf86cd799439022',
        title: 'Complete assignment',
        attachments: [],
        populate: jest.fn().mockReturnThis(),
      };
      (Task.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(mockTask).then(callback);
        }),
      });

      // Mock project check - user is manager
      const mockProjectQuery = {
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve({
            members: [{ user: '507f1f77bcf86cd799439011', role: 'manager' }],
          }).then(callback);
        }),
      };
      (Project.findOne as jest.Mock).mockReturnValue(mockProjectQuery);

      // Mock delete operation
      (Task.findByIdAndDelete as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .delete('/api/tasks/tasks/507f1f77bcf86cd799439033')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should fail to delete task if user is only a regular member', async () => {
      const mockTask = {
        _id: '507f1f77bcf86cd799439033',
        id: '507f1f77bcf86cd799439033',
        projectId: '507f1f77bcf86cd799439022',
        title: 'Complete assignment',
        populate: jest.fn().mockReturnThis(),
      };
      (Task.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(mockTask).then(callback);
        }),
      });

      // Mock project check - user is regular member (not manager/admin)
      const mockProjectQuery = {
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve({
            members: [{ user: '507f1f77bcf86cd799439011', role: 'member' }],
          }).then(callback);
        }),
      };
      (Project.findOne as jest.Mock).mockReturnValue(mockProjectQuery);

      const response = await request(app)
        .delete('/api/tasks/tasks/507f1f77bcf86cd799439033')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access Denied');
    });
  });
});
