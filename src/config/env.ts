import dotenv from 'dotenv';

// Carga de variables de entorno desde el archivo .env
dotenv.config();

/**
 * Interface que representa la configuracion validada de la aplicacion.
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiSecretKey: string;
  databaseUrl: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  otp: {
    expirationSeconds: number;
    maxAttempts: number;
  };
}

/**
 * Parsea y valida las variables de entorno sin exponer valores sensibles.
 */
function loadConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const apiSecretKey = process.env.API_SECRET_KEY || '';
  const databaseUrl = process.env.DATABASE_URL || '';

  const smtpHost = process.env.SMTP_HOST || '';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpFrom = process.env.SMTP_FROM || 'Notifier Service <noreply@notifier.local>';

  const expirationSeconds = parseInt(process.env.OTP_EXPIRATION_SECONDS || '600', 10);
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);

  return {
    port: Number.isNaN(port) ? 3000 : port,
    nodeEnv,
    apiSecretKey,
    databaseUrl,
    smtp: {
      host: smtpHost,
      port: Number.isNaN(smtpPort) ? 587 : smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom,
    },
    otp: {
      expirationSeconds: Number.isNaN(expirationSeconds) ? 600 : expirationSeconds,
      maxAttempts: Number.isNaN(maxAttempts) ? 3 : maxAttempts,
    },
  };
}

export const env = loadConfig();
