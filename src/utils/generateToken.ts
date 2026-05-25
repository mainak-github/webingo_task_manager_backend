import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Types } from 'mongoose';

export interface TokenPayload {
  userId: string;
  role: string;
}

export function generateAccessToken(userId: Types.ObjectId | string, role: string): string {
  const payload: TokenPayload = { userId: userId.toString(), role };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn as any,
  });
}

export function generateRefreshToken(userId: Types.ObjectId | string, role: string): string {
  const payload: TokenPayload = { userId: userId.toString(), role };
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}
