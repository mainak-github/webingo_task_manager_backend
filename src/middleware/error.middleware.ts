import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { ValidationError } from '../errors/ValidationError';
import { env } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any = undefined;

  // Log error stack for debugging
  console.error(`[Error Handler] [${req.method}] ${req.url} - Error:`, err);

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    if (err instanceof ValidationError) {
      errors = err.errors;
    }
  } else if (err.name === 'ValidationError') {
    // Mongo Validation Error
    statusCode = 400;
    message = err.message;
  } else if (err.code === 11000) {
    // Mongo Duplicate Key
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value: ${field} already exists.`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
}
