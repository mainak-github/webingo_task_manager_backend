import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';

// Helper set secure HttpOnly cookie for refresh token
const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching token expiration
  });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const user = await authService.register({ name, email, password } as any);
  
  res.status(201).json(
    new ApiResponse(201, { status: 'pending_verification', email: user.email }, 'Registration successful! Verification code sent to your email.')
  );
});

export const verifyRegistrationOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const { user, accessToken, refreshToken } = await authService.verifyRegistrationOtp(email, otp);

  setRefreshTokenCookie(res, refreshToken);

  res.status(200).json(
    new ApiResponse(200, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: accessToken,
    }, 'Email successfully verified!')
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  if (result.requires2fa) {
    return res.status(200).json(
      new ApiResponse(200, {
        status: 'pending_2fa',
        email: result.email,
      }, 'Two-factor verification required.')
    );
  }

  const user = result.user!;
  setRefreshTokenCookie(res, result.refreshToken!);

  res.status(200).json(
    new ApiResponse(200, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: result.accessToken,
    }, 'Login successful.')
  );
});

export const verify2fa = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const { user, accessToken, refreshToken } = await authService.verify2fa(email, otp);

  setRefreshTokenCookie(res, refreshToken);

  res.status(200).json(
    new ApiResponse(200, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: accessToken,
    }, 'Two-Factor login successful!')
  );
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, type } = req.body;
  await authService.resendOtp(email, type);
  res.status(200).json(new ApiResponse(200, null, 'Verification code resent successfully.'));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.token || req.body?.refreshToken;

  if (!token) {
    return res.status(401).json(new ApiResponse(401, null, 'Refresh token is missing. Please log in again.'));
  }

  const { accessToken, refreshToken: newRefreshToken } = await authService.refresh(token);

  setRefreshTokenCookie(res, newRefreshToken);

  res.status(200).json(
    new ApiResponse(200, { token: accessToken }, 'Token refreshed successfully.')
  );
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.token || req.body?.refreshToken;
  
  if (token) {
    await authService.logout(token);
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
  });

  res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  await authService.forgotPassword(email);
  res.status(200).json(new ApiResponse(200, null, 'Password reset instruction sent to email.'));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  await authService.resetPassword(token, password);
  res.status(200).json(new ApiResponse(200, null, 'Password reset successfully. You can now log in.'));
});
