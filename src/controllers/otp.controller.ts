import { Request, Response, NextFunction } from 'express';
import { otpService } from '../services/otp.service.js';
import { SendOtpRequestDto, VerifyOtpRequestDto } from '../models/types.js';

/**
 * Controlador HTTP para la gestion de solicitudes y verificaciones de codigos OTP.
 */
export class OtpController {
  /**
   * Endpoint POST /api/otp/send
   * Genera el codigo OTP, lo almacena de forma segura y envia la notificacion.
   */
  public async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: SendOtpRequestDto = {
        app_name: req.body.app_name,
        identifier: req.body.identifier,
        channel: req.body.channel,
        template: req.body.template,
        payload: req.body.payload,
      };

      const result = await otpService.sendOtp(dto);
      res.status(200).json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Endpoint POST /api/otp/verify
   * Valida un codigo OTP ingresado por el usuario contra el hash almacenado en base de datos.
   */
  public async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: VerifyOtpRequestDto = {
        app_name: req.body.app_name,
        identifier: req.body.identifier,
        code: req.body.code,
      };

      const result = await otpService.verifyOtp(dto);
      res.status(200).json(result);
    } catch (err: unknown) {
      next(err);
    }
  }
}

export const otpController = new OtpController();
