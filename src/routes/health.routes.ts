import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../config/database.js';
import { env } from '../config/env.js';
import { HealthCheckResponseDto } from '../models/types.js';

const router = Router();

/**
 * @route   GET /health
 * @desc    Comprobacion del estado de salud del microservicio y conectividad a PostgreSQL
 * @access  Publico o monitoreo de infraestructura
 */
router.get('/', async (_req: Request, res: Response) => {
  const isDbConnected = await testDatabaseConnection();

  const response: HealthCheckResponseDto = {
    status: isDbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: isDbConnected ? 'connected' : 'disconnected',
    environment: env.nodeEnv,
  };

  const statusCode = isDbConnected ? 200 : 503;
  res.status(statusCode).json(response);
});

export const healthRoutes = router;
