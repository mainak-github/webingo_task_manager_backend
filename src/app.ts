import express from 'express';
import type { Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import mongoose from 'mongoose';

import { env } from './config/env';
import { httpLogger } from './utils/logger';
import { xssSanitizerMiddleware } from './utils/sanitize';
import { errorHandler } from './middleware/error.middleware';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { protect } from './middleware/auth.middleware';
import type { AuthenticatedRequest } from './middleware/auth.middleware';
import { projectRepository } from './repositories/project.repository';
import { Task } from './models/Task';

// Routes imports
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import notificationRoutes from './routes/notification.routes';
import uploadRoutes from './routes/upload.routes';

const app = express();
app.set('etag', false);

// Security Headers (Helmet.js)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Crucial for serving uploaded file resources locally to the react app
  })
);

// CORS configuration supporting cookies and headers
const allowedOrigins = [
  env.clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  })
);

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Request Parsing & Morgan Logging
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(httpLogger);

// XSS Input Sanitization middleware
app.use(xssSanitizerMiddleware);

// Global API rate limiting
app.use('/api/', apiRateLimiter);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function authorizeUploadedFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const filename = path.basename(req.path);
  const task = await Task.findOne({
    'attachments.url': { $regex: `${escapeRegExp(filename)}$` },
  }).select('projectId').lean();

  if (!task) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  const isMember = await projectRepository.isUserMember(task.projectId.toString(), req.user!.id);
  if (!isMember) {
    return res.status(403).json({ success: false, message: 'Access denied for this file.' });
  }

  next();
}

// Serve static uploaded files locally with project-membership verification
const UPLOADS_PATH = path.join(__dirname, '../uploads');
app.use('/uploads', protect, authorizeUploadedFile, express.static(UPLOADS_PATH));

// Mapping API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'healthy',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date(),
    database: dbStatus,
    environment: env.nodeEnv,
  });
});

// Centralized error handling
app.use(errorHandler);

export { app };
export default app;
