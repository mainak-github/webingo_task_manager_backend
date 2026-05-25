import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/task_manager',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_key',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  mailHost: process.env.MAIL_HOST || 'smtp.mailtrap.io',
  mailPort: parseInt(process.env.MAIL_PORT || '2525', 10),
  mailUser: process.env.MAIL_USER || '',
  mailPass: process.env.MAIL_PASS || '',
  mailFrom: process.env.MAIL_FROM || 'no-reply@webbingo.com',
};

if (env.nodeEnv === 'production') {
  const missing = [
    ['MONGO_URI', env.mongoUri],
    ['JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET],
    ['CLIENT_URL', process.env.CLIENT_URL],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.map(([key]) => key).join(', ')}`);
  }
}
