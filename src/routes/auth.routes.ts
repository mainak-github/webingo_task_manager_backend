import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyRegistrationSchema,
  verify2faSchema,
  resendOtpSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/verify-registration', validate(verifyRegistrationSchema), authController.verifyRegistrationOtp);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/verify-2fa', validate(verify2faSchema), authController.verify2fa);
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;
