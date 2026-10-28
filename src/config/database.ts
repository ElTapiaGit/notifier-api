import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

const { Pool } = pg;

/**
 * Configuracion del pool de conexiones a PostgreSQL.
 * Utiliza DATABASE_URL respetando estrictamente el esquema existente 'notifier_db'.
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err: Error) => {
  logger.error('Error imprevisto en el cliente inactivo del pool de PostgreSQL', {
    errorName: err.name,
    errorMessage: err.message,
  });
});

/**
 * Ejecuta una consulta SQL parametrizada garantizando el uso de buenas practicas.
 * Evita inyecciones SQL mediante consultas preparadas ($1, $2, etc.).
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('Consulta SQL ejecutada con exito', {
      rowCount: res.rowCount,
      durationMs: duration,
    });
    return res;
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Error al ejecutar consulta SQL en PostgreSQL', {
      errorName: error.name,
      errorMessage: error.message,
    });
    throw err;
  }
}

/**
 * Verifica la conectividad con la base de datos sin interrumpir el arranque.
 */
export async function testDatabaseConnection(): Promise<boolean> {
  if (!env.databaseUrl) {
    logger.warn('DATABASE_URL no esta configurada en las variables de entorno');
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      logger.info('Conexion exitosa con el servidor PostgreSQL (notifier_db)');
      return true;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn('No se pudo establecer conexion inicial con PostgreSQL', {
      errorName: error.name,
      errorMessage: error.message,
    });
    return false;
  }
}

/**
 * Cierra limpiamente el pool de conexiones.
 */
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    logger.info('Pool de conexiones de PostgreSQL cerrado correctamente');
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Error al cerrar el pool de conexiones de PostgreSQL', {
      errorMessage: error.message,
    });
  }
}
