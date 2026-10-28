import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { CryptoService } from './crypto.service.js';
import { emailService } from './email.service.js';
import { otpRepository } from '../repositories/otp.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import {
  SendOtpRequestDto,
  SendOtpResponseDto,
  VerifyOtpRequestDto,
  VerifyOtpResponseSuccessDto,
} from '../models/types.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  BadGatewayError,
} from '../models/errors.js';

export class OtpService {
  /**
   * Genera un codigo OTP, lo almacena hasheado en la base de datos,
   * renderiza la plantilla EJS, envia el correo y registra la auditoria.
   */
  public async sendOtp(dto: SendOtpRequestDto): Promise<SendOtpResponseDto> {
    const channel = dto.channel || 'email';
    const templateName = dto.template || 'otp-default';
    const requestId = CryptoService.generateUuid();

    // 1. Generar codigo OTP seguro de 6 digitos
    const rawCode = CryptoService.generateOtpCode();

    // 2. Calcular tiempo de expiracion
    const expiresInSeconds = env.otp.expirationSeconds;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const expiresInMinutes = Math.ceil(expiresInSeconds / 60);

    // 3. Hashear codigo para almacenamiento seguro
    const hashedCode = await CryptoService.hashOtp(rawCode);

    // 4. Guardar en base de datos (tabla otp_requests)
    await otpRepository.create({
      id: requestId,
      app_name: dto.app_name,
      identifier: dto.identifier,
      channel,
      otp_code: hashedCode,
      attempts: 0,
      status: 'pending',
      expires_at: expiresAt,
    });

    logger.info('Registro OTP creado en base de datos con estado pendiente', {
      requestId,
      appName: dto.app_name,
      identifier: dto.identifier,
      channel,
    });

    // 5. Enviar notificacion y registrar en notification_logs
    const notificationLogId = CryptoService.generateUuid();

    try {
      if (channel === 'email') {
        await emailService.sendOtpEmail({
          to: dto.identifier,
          appName: dto.app_name,
          templateName,
          code: rawCode,
          expiresInMinutes,
          payload: dto.payload,
        });
      } else {
        logger.warn(`Canal '${channel}' no implementado aun, simulando despacho`, {
          channel,
        });
      }

      // Registro exitoso en notification_logs
      await notificationRepository.createLog({
        id: notificationLogId,
        app_name: dto.app_name,
        identifier: dto.identifier,
        channel,
        template_used: templateName,
        status: 'sent',
      });

      logger.info('Auditoria de notificacion registrada exitosamente', {
        notificationLogId,
        status: 'sent',
      });
    } catch (err: unknown) {
      const error = err as Error;

      // Registro de fallo en notification_logs
      await notificationRepository.createLog({
        id: notificationLogId,
        app_name: dto.app_name,
        identifier: dto.identifier,
        channel,
        template_used: templateName,
        status: 'failed',
        error_message: error.message,
      });

      // Quemar o expirar la solicitud OTP para que no quede huerfana
      await otpRepository.updateStatus(requestId, 'expired');

      logger.error('Fallo en el despacho de notificacion OTP. Solicitud cancelada.', {
        requestId,
        appName: dto.app_name,
        identifier: dto.identifier,
        errorMessage: error.message,
      });

      throw new BadGatewayError('Fallo en el envio de la notificacion. Intente nuevamente.');
    }

    return {
      message: 'OTP enviado',
      expires_in: expiresInSeconds,
    };
  }

  /**
   * Verifica un codigo OTP contra el registro mas reciente en estado pendiente.
   * Maneja control de expiracion, verificacion de hash y limite de intentos de fuerza bruta.
   */
  public async verifyOtp(dto: VerifyOtpRequestDto): Promise<VerifyOtpResponseSuccessDto> {
    // 1. Buscar registro mas reciente pendiente
    const record = await otpRepository.findLatestPending(dto.app_name, dto.identifier);

    if (!record) {
      logger.warn('Intento de verificacion sin solicitud pendiente activa', {
        appName: dto.app_name,
        identifier: dto.identifier,
      });
      throw new NotFoundError('No existe una solicitud OTP pendiente para los datos indicados');
    }

    const now = Date.now();
    const expiresAtMs = new Date(record.expires_at).getTime();

    // 2. Validar expiracion temporal
    if (now > expiresAtMs) {
      await otpRepository.updateStatus(record.id, 'expired');
      logger.warn('Intento de verificacion de OTP expirado', {
        requestId: record.id,
        appName: dto.app_name,
        identifier: dto.identifier,
      });
      throw new BadRequestError('El codigo OTP ha expirado');
    }

    // 3. Comparar hash del codigo proporcionado
    const isValid = await CryptoService.verifyOtpHash(dto.code, record.otp_code);

    if (!isValid) {
      const currentAttempts = record.attempts + 1;
      const maxAttempts = env.otp.maxAttempts;

      if (currentAttempts >= maxAttempts) {
        // Quemar el codigo al alcanzar el limite de intentos fallidos
        await otpRepository.updateAttempts(record.id, currentAttempts, 'expired');
        logger.warn('Intento fallido de OTP. Limite maximo alcanzado, codigo expirado (posible ataque)', {
          requestId: record.id,
          appName: dto.app_name,
          identifier: dto.identifier,
          attempts: currentAttempts,
        });
        throw new UnauthorizedError('Codigo OTP invalido. Limite de intentos alcanzado, codigo expirado.');
      }

      // Incrementar contador de intentos
      await otpRepository.updateAttempts(record.id, currentAttempts);
      const remainingAttempts = maxAttempts - currentAttempts;

      logger.warn('Intento fallido de verificacion de codigo OTP', {
        requestId: record.id,
        appName: dto.app_name,
        identifier: dto.identifier,
        attempts: currentAttempts,
        remainingAttempts,
      });

      throw new UnauthorizedError('Codigo OTP invalido', remainingAttempts);
    }

    // 4. Codigo correcto: actualizar estado a verificado
    await otpRepository.updateStatus(record.id, 'verified');

    logger.info('Codigo OTP verificado satisfactoriamente', {
      requestId: record.id,
      appName: dto.app_name,
      identifier: dto.identifier,
    });

    return {
      valid: true,
    };
  }
}

export const otpService = new OtpService();
