import { Request, Response, NextFunction } from 'express';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SIX_DIGITS_REGEX = /^\d{6}$/;

/**
 * Middleware para validar el payload de la peticion POST /api/otp/send.
 */
export function validateSendOtpRequest(req: Request, res: Response, next: NextFunction): void {
  const { app_name, identifier, channel, template, payload } = req.body || {};
  const errors: string[] = [];

  if (!app_name || typeof app_name !== 'string' || app_name.trim().length === 0) {
    errors.push('El campo app_name es obligatorio y debe ser una cadena no vacia.');
  }

  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    errors.push('El campo identifier es obligatorio y debe ser una cadena no vacia.');
  } else {
    const targetChannel = (channel || 'email').toLowerCase();
    if (targetChannel === 'email' && !EMAIL_REGEX.test(identifier.trim())) {
      errors.push('El campo identifier debe tener un formato de correo electronico valido para el canal email.');
    }
  }

  if (channel !== undefined && (typeof channel !== 'string' || channel.trim().length === 0)) {
    errors.push('El campo channel debe ser una cadena de texto valida si se proporciona.');
  }

  if (template !== undefined && (typeof template !== 'string' || template.trim().length === 0)) {
    errors.push('El campo template debe ser una cadena de texto valida si se proporciona.');
  }

  if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
    errors.push('El campo payload debe ser un objeto JSON valido si se proporciona.');
  }

  if (errors.length > 0) {
    res.status(400).json({
      error: 'Datos de entrada invalidos',
      details: errors,
    });
    return;
  }

  next();
}

/**
 * Middleware para validar el payload de la peticion POST /api/otp/verify.
 */
export function validateVerifyOtpRequest(req: Request, res: Response, next: NextFunction): void {
  const { app_name, identifier, code } = req.body || {};
  const errors: string[] = [];

  if (!app_name || typeof app_name !== 'string' || app_name.trim().length === 0) {
    errors.push('El campo app_name es obligatorio y debe ser una cadena no vacia.');
  }

  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    errors.push('El campo identifier es obligatorio y debe ser una cadena no vacia.');
  }

  if (!code || typeof code !== 'string' || !SIX_DIGITS_REGEX.test(code.trim())) {
    errors.push('El campo code es obligatorio y debe contener exactamente 6 digitos numericos.');
  }

  if (errors.length > 0) {
    res.status(400).json({
      error: 'Datos de entrada invalidos',
      details: errors,
    });
    return;
  }

  next();
}
