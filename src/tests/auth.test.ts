import request from 'supertest';
import { app } from '../app';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { mailService } from '../config/mail';

jest.mock('../models/User');
jest.mock('../models/RefreshToken');
jest.mock('../config/mail');

describe('Authentication API Endpoint Tests', () => {
  const mockUserData = {
    name: 'Rick B',
    email: 'rick@webbingo.com',
    password: 'password123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and send a verification email', async () => {
      // Mock existing user search
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // Mock save operation
      const mockSave = jest.fn().mockResolvedValue({
        id: 'user-123',
        name: mockUserData.name,
        email: mockUserData.email,
        role: 'member',
        isVerified: false,
      });
      (User as any).mockImplementation(() => ({
        save: mockSave,
        ...mockUserData,
      }));

      // Mock email sending
      (mailService.sendMail as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockUserData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending_verification');
    });

    it('should return 422 if invalid email format is provided', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rick B',
          email: 'invalid-email-format',
          password: 'password123',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation Failed');
    });
  });

  describe('POST /api/auth/verify-registration', () => {
    it('should verify registration otp and activate user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: mockUserData.email,
        role: 'member',
        otpCode: '123456',
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        isVerified: false,
        save: jest.fn().mockResolvedValue(true),
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Mock refresh token save
      const mockTokenSave = jest.fn().mockResolvedValue({});
      (RefreshToken as any).mockImplementation(() => ({
        save: mockTokenSave,
      }));

      const response = await request(app)
        .post('/api/auth/verify-registration')
        .send({
          email: mockUserData.email,
          otp: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate credentials and return pending_2fa state with OTP sent', async () => {
      const mockComparePassword = jest.fn().mockResolvedValue(true);
      const mockUser = {
        id: 'user-123',
        name: mockUserData.name,
        email: mockUserData.email,
        role: 'member',
        isVerified: true,
        comparePassword: mockComparePassword,
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock query chain (findOne + select) using thenable mapping
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(mockUser).then(callback);
        }),
      };
      (User.findOne as jest.Mock).mockReturnValue(mockQuery);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: mockUserData.email,
          password: mockUserData.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending_2fa');
      expect(response.body.data.email).toBe(mockUserData.email);
    });

    it('should fail with 401 if invalid credentials are submitted', async () => {
      const mockComparePassword = jest.fn().mockResolvedValue(false);
      const mockUser = {
        id: 'user-123',
        email: mockUserData.email,
        comparePassword: mockComparePassword,
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (callback) {
          return Promise.resolve(mockUser).then(callback);
        }),
      };
      (User.findOne as jest.Mock).mockReturnValue(mockQuery);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: mockUserData.email,
          password: 'wrong_password',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-2fa', () => {
    it('should verify 2fa code successfully and return session tokens', async () => {
      const mockUser = {
        id: 'user-123',
        email: mockUserData.email,
        role: 'member',
        loginOtpCode: '123456',
        loginOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock refresh token save
      const mockTokenSave = jest.fn().mockResolvedValue({});
      (RefreshToken as any).mockImplementation(() => ({
        save: mockTokenSave,
      }));

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          email: mockUserData.email,
          otp: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });
  });
});
