import { Request, Response, NextFunction } from 'express';
import { AppError } from '../models/errors.js';
import { logger } from '../config/logger.js';

/**
 * Middleware global para la gestion centralizada de errores en Express.
 * Asegura que ninguna credencial, secreto o detalle interno de la base de datos
 * sea expuesto en las respuestas HTTP a los clientes.
 */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (err instanceof AppError) {
    logger.warn('Error operacional capturado en controlador', {
      statusCode: err.statusCode,
      message: err.message,
      path: req.originalUrl,
      method: req.method,
      ip: clientIp,
    });

    res.status(err.statusCode).json({
      error: err.message,
      ...(err.remainingAttempts !== undefined ? { remaining_attempts: err.remainingAttempts } : {}),
    });
    return;
  }

  // Error inesperado del sistema (500)
  const unexpectedError = err as Error;
  logger.error('Error no controlado en la ejecucion de la peticion', {
    errorName: unexpectedError.name,
    errorMessage: unexpectedError.message,
    stack: unexpectedError.stack,
    path: req.originalUrl,
    method: req.method,
    ip: clientIp,
  });

  res.status(500).json({
    error: 'Error interno del servidor. Por favor contacte al administrador.',
  });
}

/**
 * Middleware para capturar rutas no encontradas (404).
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}
