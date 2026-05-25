import mongoose from 'mongoose';

// Override env variables for testing security
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/task_manager_test';
process.env.JWT_ACCESS_SECRET = 'test_access_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_key';

// Mock mongoose connection so tests can run in environments without MongoDB active
jest.mock('../config/db', () => ({
  connectDB: jest.fn().mockImplementation(() => Promise.resolve()),
}));

// Mock Redis connection so tests can run without Redis active
jest.mock('../config/redis', () => ({
  cacheService: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve()),
    del: jest.fn().mockImplementation(() => Promise.resolve()),
    delPattern: jest.fn().mockImplementation(() => Promise.resolve()),
  },
  default: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve()),
    del: jest.fn().mockImplementation(() => Promise.resolve()),
    delPattern: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));

beforeAll(async () => {
  // Mock console.log and warn to keep Jest outputs clean
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(async () => {
  jest.restoreAllMocks();
});
