import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/generateToken';
import { userRepository } from '../repositories/user.repository';

export async function socketAuth(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication failed. No token provided.'));
    }

    // Verify accessToken
    const decoded = verifyAccessToken(token);

    // Fetch user to match existence
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      return next(new Error('Authentication failed. User no longer exists.'));
    }

    // Attach user profile info to the socket connection data stack
    socket.data.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(new Error('Authentication failed. Invalid or expired token.'));
  }
}
