import winston from 'winston';
import { env } from './env.js';

/**
 * Lista de claves sensibles que deben ser enmascaradas en cualquier registro de log.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'secret',
  'api_key',
  'apikey',
  'x-api-key',
  'token',
  'authorization',
  'code',
  'otp_code',
  'otp',
  'smtp_pass',
  'database_url',
]);

/**
 * Funcion recursiva para sanitizar objetos y evitar la exposicion de credenciales o secretos.
 */
function sanitizeMeta(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Si la cadena contiene patrones de URL con credenciales, sanitizar
    return value.replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@');
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeMeta);
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        sanitized[k] = '***REDACTED***';
      } else {
        sanitized[k] = sanitizeMeta(v);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Formateador personalizado de Winston para sanitizacion automatica de metadata.
 */
const sanitizerFormat = winston.format((info) => {
  const clean = sanitizeMeta(info);
  return clean as winston.Logform.TransformableInfo;
});

/**
 * Configuracion del logger estructurado con Winston.
 */
export const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    sanitizerFormat(),
    env.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const metaString = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
          const stackString = stack ? `\n${stack}` : '';
          return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaString}${stackString}`;
        })
  ),
  defaultMeta: { service: 'notifier-api' },
  transports: [
    new winston.transports.Console({
      silent: env.nodeEnv === 'test',
    }),
  ],
});
