import { User, type IUser } from '../models/User';
import { RefreshToken, type IRefreshToken } from '../models/RefreshToken';
import type { Types } from 'mongoose';

export class UserRepository {
  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const query = User.findOne({ email });
    if (includePassword) {
      query.select('+password');
    }
    return query;
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return user.save();
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, { $set: userData }, { new: true, runValidators: true });
  }

  // Refresh token management operations
  async saveRefreshToken(userId: Types.ObjectId | string, token: string, expiresAt: Date): Promise<IRefreshToken> {
    // Delete existing token if any to maintain single active session per device / clean token rotation
    await RefreshToken.deleteOne({ token });
    const refreshToken = new RefreshToken({ userId, token, expiresAt });
    return refreshToken.save();
  }

  async findRefreshToken(token: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOne({ token }).populate('userId');
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await RefreshToken.deleteOne({ token });
  }

  async deleteRefreshTokensForUser(userId: Types.ObjectId | string): Promise<void> {
    await RefreshToken.deleteMany({ userId });
  }
}

export const userRepository = new UserRepository();
export default userRepository;
