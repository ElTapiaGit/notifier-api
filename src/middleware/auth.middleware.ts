import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { CryptoService } from '../services/crypto.service.js';

/**
 * Middleware de seguridad para autenticacion de la API.
 * Valida que el encabezado 'x-api-key' coincida con la variable de entorno API_SECRET_KEY
 * utilizando comparacion en tiempo constante para mitigar ataques de temporizacion.
 */
export function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.header('x-api-key');
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!env.apiSecretKey) {
    logger.error('CRITICAL: API_SECRET_KEY no esta configurada en el servidor');
    res.status(500).json({
      error: 'Error de configuracion interna del servidor',
    });
    return;
  }

  if (!apiKeyHeader) {
    logger.warn('Intento de acceso no autorizado sin API Key', {
      ip: clientIp,
      method: req.method,
      path: req.originalUrl,
    });
    res.status(401).json({
      error: 'Acceso no autorizado: Encabezado x-api-key no proporcionado',
    });
    return;
  }

  const isValid = CryptoService.timingSafeCompare(env.apiSecretKey, apiKeyHeader);

  if (!isValid) {
    logger.warn('Intento de acceso con API Key invalida', {
      ip: clientIp,
      method: req.method,
      path: req.originalUrl,
    });
    res.status(401).json({
      error: 'Acceso no autorizado: API Key invalida',
    });
    return;
  }

  next();
}
