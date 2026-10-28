import { Router } from 'express';
import { otpController } from '../controllers/otp.controller.js';
import {
  sendOtpRateLimiter,
  verifyOtpRateLimiter,
} from '../middleware/rateLimiter.middleware.js';
import {
  validateSendOtpRequest,
  validateVerifyOtpRequest,
} from '../middleware/validator.middleware.js';

const router = Router();

/**
 * @route   POST /api/otp/send
 * @desc    Genera y envia un codigo OTP de 6 digitos al identificador especificado
 * @access  Protegido por x-api-key
 */
router.post(
  '/send',
  sendOtpRateLimiter,
  validateSendOtpRequest,
  otpController.sendOtp.bind(otpController)
);

/**
 * @route   POST /api/otp/verify
 * @desc    Verifica un codigo OTP contra el registro activo mas reciente
 * @access  Protegido por x-api-key
 */
router.post(
  '/verify',
  verifyOtpRateLimiter,
  validateVerifyOtpRequest,
  otpController.verifyOtp.bind(otpController)
);

export const otpRoutes = router;
