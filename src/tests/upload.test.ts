import request from 'supertest';
import { app } from '../app';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

jest.mock('../models/User');

describe('File Upload API Endpoint Tests', () => {
  let mockToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockToken = jwt.sign(
      { userId: 'user-123', role: 'member' },
      'test_access_key'
    );

    (User.findById as jest.Mock).mockResolvedValue({
      id: 'user-123',
      name: 'Rick B',
      email: 'rick@webbingo.com',
      role: 'member',
    });
  });

  describe('POST /api/upload', () => {
    it('should reject file upload if no file is provided', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('provide a file');
    });
  });
});
