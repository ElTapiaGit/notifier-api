import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../config/logger.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Limitador de tasa para el endpoint de solicitud de codigos OTP.
 * Regla: Maximo 3 peticiones por IP en una ventana de 15 minutos.
 */
export const sendOtpRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    logger.warn('Limite de tasa excedido en solicitud de OTP', {
      ip: clientIp,
      path: req.originalUrl,
      limit: 3,
      windowMinutes: 15,
    });
    res.status(429).json({
      error: 'Demasiadas solicitudes de envio de OTP. Por favor intente nuevamente en 15 minutos.',
    });
  },
});

/**
 * Limitador de tasa para el endpoint de verificacion de codigos OTP.
 * Regla: Maximo 5 intentos por IP en una ventana de 15 minutos.
 */
export const verifyOtpRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    logger.warn('Limite de tasa excedido en verificacion de OTP', {
      ip: clientIp,
      path: req.originalUrl,
      limit: 5,
      windowMinutes: 15,
    });
    res.status(429).json({
      error: 'Demasiados intentos de verificacion de OTP. Por favor intente nuevamente en 15 minutos.',
    });
  },
});
