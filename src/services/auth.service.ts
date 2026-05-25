import { userRepository } from '../repositories/user.repository';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/generateToken';
import { mailService } from '../config/mail';
import { BadRequestError } from '../errors/BadRequestError';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { NotFoundError } from '../errors/NotFoundError';
import crypto from 'crypto';
import type { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { buildClientUrl } from '../utils/clientUrl';

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

      // Send Verification Email with OTP
      await mailService.sendMail({
        to: user.email,
        subject: 'Verify Your Email Address - WebBingo Task Manager',
        html: `
          <h1>Email Verification</h1>
          <p>Hi ${user.name},</p>
          <p>Thank you for registering on our real-time project workspace. Your 6-digit verification code is:</p>
          <h2 style="font-size: 24px; letter-spacing: 5px; color: #3b82f6;">${otpCode}</h2>
          <p>This code will expire in 10 minutes.</p>
        `,
      });

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

      // Send 2FA login email
      await mailService.sendMail({
        to: user.email,
        subject: 'Two-Factor Authentication Code - WebBingo Task Manager',
        html: `
          <h1>Two-Factor Verification</h1>
          <p>Hi ${user.name},</p>
          <p>A login attempt requires verification. Your 6-digit two-factor authentication code is:</p>
          <h2 style="font-size: 24px; letter-spacing: 5px; color: #10b981;">${loginOtpCode}</h2>
          <p>This code will expire in 10 minutes.</p>
        `,
      });

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

        await mailService.sendMail({
          to: user.email,
          subject: 'Verify Your Email Address - WebBingo Task Manager',
          html: `
            <h1>Email Verification</h1>
            <p>Hi ${user.name},</p>
            <p>Your new 6-digit verification code is:</p>
            <h2 style="font-size: 24px; letter-spacing: 5px; color: #3b82f6;">${otpCode}</h2>
            <p>This code will expire in 10 minutes.</p>
          `,
        });
      } else {
        user.loginOtpCode = otpCode;
        user.loginOtpExpiresAt = expiresAt;
        await user.save();

        await mailService.sendMail({
          to: user.email,
          subject: 'Two-Factor Authentication Code - WebBingo Task Manager',
          html: `
            <h1>Two-Factor Verification</h1>
            <p>Hi ${user.name},</p>
            <p>Your new 6-digit two-factor authentication code is:</p>
            <h2 style="font-size: 24px; letter-spacing: 5px; color: #10b981;">${otpCode}</h2>
            <p>This code will expire in 10 minutes.</p>
          `,
        });
      }
    });
  }

  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    return logger.profile('AuthService.refresh', async () => {
      // 1. Verify token
      const decoded = verifyRefreshToken(token);

      // 2. Query DB to match active token
      const savedToken = await userRepository.findRefreshToken(token);
      if (!savedToken) {
        throw new UnauthorizedError('Token is invalid or has expired.');
      }

      // 3. User verification
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedError('User no longer exists.');
      }

      // 4. Token rotation logic for robust security
      const newAccessToken = generateAccessToken(user.id, user.role);
      const newRefreshToken = generateRefreshToken(user.id, user.role);

      // Save rotated refresh token in place
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await userRepository.deleteRefreshToken(token);
      await userRepository.saveRefreshToken(user.id, newRefreshToken, expiresAt);

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

      // Send Reset Link
      const resetLink = buildClientUrl('/reset-password', { token: resetToken });
      await mailService.sendMail({
        to: user.email,
        subject: 'Password Reset Request - WebBingo Task Manager',
        html: `
          <h1>Password Reset</h1>
          <p>You are receiving this email because you requested a password reset. Please click the link below to complete the process:</p>
          <a href="${resetLink}">${resetLink}</a>
        `,
      });
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
