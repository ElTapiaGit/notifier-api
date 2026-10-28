/**
 * Definiciones de tipos e interfaces del dominio para notifier-api.
 * Mapeo estricto del esquema de base de datos PostgreSQL y DTOs de transporte.
 */

export type OtpStatus = 'pending' | 'verified' | 'expired';

export type NotificationStatus = 'sent' | 'failed';

export interface OtpRequestRecord {
  id: string;
  app_name: string;
  identifier: string;
  channel: string;
  otp_code: string;
  attempts: number;
  status: OtpStatus;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationLogRecord {
  id: string;
  app_name: string;
  identifier: string;
  channel: string;
  template_used: string;
  status: NotificationStatus;
  error_message: string | null;
  created_at: Date;
}

export interface SendOtpRequestDto {
  app_name: string;
  identifier: string;
  channel?: string;
  template?: string;
  payload?: Record<string, unknown>;
}

export interface SendOtpResponseDto {
  message: string;
  expires_in: number;
}

export interface VerifyOtpRequestDto {
  app_name: string;
  identifier: string;
  code: string;
}

export interface VerifyOtpResponseSuccessDto {
  valid: true;
}

export interface VerifyOtpResponseFailureDto {
  error: string;
  remaining_attempts?: number;
}

export interface HealthCheckResponseDto {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime_seconds: number;
  database: 'connected' | 'disconnected';
  environment: string;
}
