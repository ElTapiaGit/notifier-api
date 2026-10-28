import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { testDatabaseConnection, closeDatabasePool } from './config/database.js';

/**
 * Captura global de excepciones no controladas en el hilo de ejecucion.
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('CRITICAL: uncaughtException detectada en el proceso Node.js', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
  // Salida controlada para permitir reinicio por orquestador
  process.exit(1);
});

/**
 * Captura global de promesas rechazadas no manejadas.
 */
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('CRITICAL: unhandledRejection detectada en el proceso Node.js', {
    reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : reason,
  });
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const app = createApp();

  // Verificacion de conectividad con la base de datos
  await testDatabaseConnection();

  const server = app.listen(env.port, () => {
    logger.info(`Microservicio notifier-api iniciado correctamente en el puerto ${env.port}`, {
      environment: env.nodeEnv,
      port: env.port,
    });
  });

  // Manejo de apagado elegante (Graceful Shutdown)
  const shutdown = async (signal: string) => {
    logger.info(`Senal ${signal} recibida. Iniciando cierre elegante del servidor...`);

    server.close(async () => {
      logger.info('Servidor HTTP detenido para nuevas conexiones');
      await closeDatabasePool();
      logger.info('Recursos liberados satisfactoriamente. Proceso finalizado.');
      process.exit(0);
    });

    // Forzar cierre si excede los 10 segundos
    setTimeout(() => {
      logger.error('Cierre forzado: Se supero el tiempo limite para liberar recursos');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  const error = err as Error;
  logger.error('Error fatal durante la inicializacion de la aplicacion', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
