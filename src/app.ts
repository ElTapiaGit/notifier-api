import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { apiKeyAuthMiddleware } from './middleware/auth.middleware.js';
import { errorHandlerMiddleware, notFoundHandler } from './middleware/error.middleware.js';
import { otpRoutes } from './routes/otp.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { logger } from './config/logger.js';

export function createApp(): Express {
  const app = express();

  // 1. Desactivar cabecera x-powered-by para mitigar identificacion de tecnologica
  app.disable('x-powered-by');

  // 2. Cabeceras de seguridad HTTP
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
  });

  // 3. CORS
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'x-api-key'],
    })
  );

  // 4. Parseo de cuerpo JSON y URL-encoded con limite de tamano para mitigar DoS
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // 5. Middleware de registro de peticiones HTTP
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const logMessage = `${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`;

      if (statusCode >= 500) {
        logger.error(logMessage, { ip: clientIp, statusCode, durationMs });
      } else if (statusCode >= 400) {
        logger.warn(logMessage, { ip: clientIp, statusCode, durationMs });
      } else {
        logger.info(logMessage, { ip: clientIp, statusCode, durationMs });
      }
    });

    next();
  });

  // 6. Rutas de salud (Health Check publicas)
  app.use('/health', healthRoutes);
  app.use('/api/health', healthRoutes);

  // 7. Rutas protegidas de la API con autenticacion por API Key obligatoria
  app.use('/api/otp', apiKeyAuthMiddleware, otpRoutes);

  // 8. Manejo de recursos no encontrados (404)
  app.use(notFoundHandler);

  // 9. Manejador centralizado de excepciones y errores (500, 400, 401, 502)
  app.use(errorHandlerMiddleware);

  return app;
}
