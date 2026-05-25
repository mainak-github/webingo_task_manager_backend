import { userRepository } from '../repositories/user.repository';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/generateToken';
import { emailQueueService } from './emailQueue.service';
import { BadRequestError } from '../errors/BadRequestError';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { NotFoundError } from '../errors/NotFoundError';
import crypto from 'crypto';
import type { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { buildClientUrl } from '../utils/clientUrl';
import { buildVerificationOtpEmail, build2faOtpEmail, buildPasswordResetEmail } from '../utils/emailTemplates';

export class AuthService {
  async register(userData: Partial<IUser>): Promise<IUser> {
    return logger.profile('AuthService.register', async () => {
      // Check existing email
      const existingUser = await userRepository.findByEmail(userData.email!);
      if (existingUser) {
        throw new BadRequestError('Email is already registered.');
      }

      // Generate 6-digit verification OTP
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const user = await userRepository.create({
        ...userData,
        otpCode,
        otpExpiresAt,
        isVerified: false,
      });

      // Queue Verification Email with OTP in the durable database background queue
      await emailQueueService.queueMail(
        user.email,
        'Verify Your Email Address - WebBingo',
        buildVerificationOtpEmail(user.name, otpCode)
      );

      return user;
    });
  }

  async verifyRegistrationOtp(email: string, otp: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    return logger.profile('AuthService.verifyRegistrationOtp', async () => {
      const User = require('../models/User').User;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        throw new BadRequestError('User account not found.');
      }

      if (user.isVerified) {
        throw new BadRequestError('Email address is already verified.');
      }

      if (!user.otpCode || !user.otpExpiresAt || user.otpCode !== otp || new Date() > user.otpExpiresAt) {
        throw new BadRequestError('Invalid or expired verification code.');
      }

      // Mark user as verified
      user.isVerified = true;
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      await user.save();

      // Log the user in directly upon successful registration verification!
      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken(user.id, user.role);

      // Save refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

      return { user, accessToken, refreshToken };
    });
  }

  async login(email: string, password: string): Promise<{ requires2fa: boolean; email: string; user?: IUser; accessToken?: string; refreshToken?: string }> {
    return logger.profile('AuthService.login', async () => {
      // Fetch user including password
      const user = await userRepository.findByEmail(email, true);
      if (!user) {
        throw new UnauthorizedError('Invalid email or password.');
      }

      // Compare passwords
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new UnauthorizedError('Invalid email or password.');
      }

      // Check verification
      if (!user.isVerified) {
        throw new BadRequestError('unverified_email');
      }

      // Generate 2FA OTP
      const loginOtpCode = crypto.randomInt(100000, 999999).toString();
      const loginOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      user.loginOtpCode = loginOtpCode;
      user.loginOtpExpiresAt = loginOtpExpiresAt;
      await user.save();

      // Queue 2FA login email in the durable database background queue
      await emailQueueService.queueMail(
        user.email,
        'Two-Factor Authentication Code - WebBingo',
        build2faOtpEmail(user.name, loginOtpCode)
      );

      return { requires2fa: true, email: user.email };
    });
  }

  async verify2fa(email: string, otp: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    return logger.profile('AuthService.verify2fa', async () => {
      const User = require('../models/User').User;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        throw new BadRequestError('User account not found.');
      }

      if (!user.loginOtpCode || !user.loginOtpExpiresAt || user.loginOtpCode !== otp || new Date() > user.loginOtpExpiresAt) {
        throw new BadRequestError('Invalid or expired 2FA code.');
      }

      // Clear login OTP
      user.loginOtpCode = undefined;
      user.loginOtpExpiresAt = undefined;
      await user.save();

      // Generate session tokens
      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken(user.id, user.role);

      // Save refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

      return { user, accessToken, refreshToken };
    });
  }

  async resendOtp(email: string, type: 'registration' | 'login'): Promise<void> {
    return logger.profile('AuthService.resendOtp', async () => {
      const User = require('../models/User').User;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        throw new BadRequestError('User account not found.');
      }

      const otpCode = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      if (type === 'registration') {
        if (user.isVerified) {
          throw new BadRequestError('Email address is already verified.');
        }
        user.otpCode = otpCode;
        user.otpExpiresAt = expiresAt;
        await user.save();

        await emailQueueService.queueMail(
          user.email,
          'Verify Your Email Address - WebBingo',
          buildVerificationOtpEmail(user.name, otpCode)
        );
      } else {
        user.loginOtpCode = otpCode;
        user.loginOtpExpiresAt = expiresAt;
        await user.save();

        await emailQueueService.queueMail(
          user.email,
          'Two-Factor Authentication Code - WebBingo',
          build2faOtpEmail(user.name, otpCode)
        );
      }
    });
  }

  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    return logger.profile('AuthService.refresh', async () => {
      // 1. Verify token
      const decoded = verifyRefreshToken(token);

      // 2. Query DB to match active token (userId is populated)
      const savedToken = await userRepository.findRefreshToken(token);
      if (!savedToken) {
        throw new UnauthorizedError('Token is invalid or has expired.');
      }

      // 3. User verification (Directly leverage populated user object from step 2, eliminating redundant findById DB call)
      const user = savedToken.userId as any;
      if (!user) {
        throw new UnauthorizedError('User no longer exists.');
      }

      // 4. Token rotation logic for robust security
      const userIdStr = user._id ? user._id.toString() : user.id;
      const newAccessToken = generateAccessToken(userIdStr, user.role);
      const newRefreshToken = generateRefreshToken(userIdStr, user.role);

      // 5. Rotate the refresh token in-place using a single, highly indexed primary key update query (<5ms)
      // This completely avoids two slow delete + insert queries
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const RefreshTokenModel = require('../models/RefreshToken').RefreshToken;
      await RefreshTokenModel.updateOne(
        { _id: savedToken._id },
        { $set: { token: newRefreshToken, expiresAt } }
      );

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    });
  }

  async logout(token: string): Promise<void> {
    await userRepository.deleteRefreshToken(token);
  }

  async forgotPassword(email: string): Promise<void> {
    return logger.profile('AuthService.forgotPassword', async () => {
      const user = await userRepository.findByEmail(email);
      if (!user) {
        throw new NotFoundError('No account with that email address exists.');
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour expiration

      await userRepository.update(user.id, {
        resetToken,
        resetTokenExpires,
      } as any);

      // Queue Reset Link email in the durable database background queue
      const resetLink = buildClientUrl('/reset-password', { token: resetToken });
      await emailQueueService.queueMail(
        user.email,
        'Password Reset Request - WebBingo',
        buildPasswordResetEmail(user.name, resetLink)
      );
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    return logger.profile('AuthService.resetPassword', async () => {
      const User = require('../models/User').User;
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpires: { $gt: new Date() },
      });

      if (!user) {
        throw new BadRequestError('Invalid or expired reset token.');
      }

      // Pre-save hook automatically encrypts password
      user.password = newPassword;
      user.resetToken = undefined;
      user.resetTokenExpires = undefined;
      await user.save();
    });
  }
}

export const authService = new AuthService();
export default authService;
