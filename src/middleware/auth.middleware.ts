import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/generateToken';
import { userRepository } from '../repositories/user.repository';
import { UnauthorizedError } from '../errors/UnauthorizedError';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function protect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query?.token) {
      token = req.query.token as string;
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new UnauthorizedError('Please log in to access this resource.'));
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Fetch user from repository
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      return next(new UnauthorizedError('The user belonging to this token no longer exists.'));
    }

    // Attach user profile context to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid token or session expired.'));
  }
}
