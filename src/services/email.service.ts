import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import nodemailer, { Transporter } from 'nodemailer';
import ejs from 'ejs';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio base de plantillas EJS
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

export interface SendEmailOptions {
  to: string;
  appName: string;
  templateName?: string;
  code: string;
  expiresInMinutes: number;
  payload?: Record<string, unknown>;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  /**
   * Inicializa el transporte SMTP de Nodemailer respetando la configuracion de entorno.
   */
  private initTransporter(): void {
    if (!env.smtp.host) {
      logger.warn('SMTP_HOST no esta configurado. Los envios reales de correo fallaran hasta que se configure.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user
        ? {
            user: env.smtp.user,
            pass: env.smtp.pass,
          }
        : undefined,
      tls: {
        rejectUnauthorized: env.nodeEnv === 'production',
      },
    });

    logger.info('Transportador SMTP de Nodemailer inicializado');
  }

  /**
   * Sanitiza y resuelve la ruta de una plantilla para prevenir ataques de Path Traversal.
   */
  private resolveTemplatePath(templateName?: string): string {
    const defaultTemplate = 'otp-default.ejs';
    const safeName = templateName
      ? templateName.replace(/[^a-zA-Z0-9_-]/g, '')
      : 'otp-default';
    const filename = safeName.endsWith('.ejs') ? safeName : `${safeName}.ejs`;

    const candidatePaths = [
      path.resolve(__dirname, '..', 'templates', filename),
      path.resolve(process.cwd(), 'src', 'templates', filename),
      path.resolve(process.cwd(), 'dist', 'templates', filename),
      path.resolve(__dirname, '..', 'templates', defaultTemplate),
      path.resolve(process.cwd(), 'src', 'templates', defaultTemplate),
      path.resolve(process.cwd(), 'dist', 'templates', defaultTemplate),
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    logger.warn(`No se encontro la plantilla '${templateName || defaultTemplate}'. Usando ruta por defecto.`);
    return path.resolve(process.cwd(), 'src', 'templates', defaultTemplate);
  }

  /**
   * Renderiza la plantilla EJS con las variables inyectadas.
   */
  public async renderTemplate(
    templateName: string | undefined,
    data: Record<string, unknown>
  ): Promise<string> {
    const templatePath = this.resolveTemplatePath(templateName);
    return ejs.renderFile(templatePath, data, { async: true });
  }

  /**
   * Envia el correo electronico con el codigo OTP utilizando el transporte configurado.
   */
  public async sendOtpEmail(options: SendEmailOptions): Promise<void> {
    if (!this.transporter) {
      this.initTransporter();
      if (!this.transporter) {
        throw new Error('El servicio de correo SMTP no se encuentra configurado');
      }
    }

    const templateData: Record<string, unknown> = {
      ...(options.payload || {}),
      app_name: options.appName,
      code: options.code,
      expires_in_minutes: options.expiresInMinutes,
    };

    const htmlContent = await this.renderTemplate(options.templateName, templateData);

    const mailOptions = {
      from: env.smtp.from,
      to: options.to,
      subject: `Codigo de verificacion - ${options.appName}`,
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Correo de notificacion OTP despachado exitosamente', {
        appName: options.appName,
        recipient: options.to,
      });
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Fallo en el despacho de correo SMTP', {
        appName: options.appName,
        recipient: options.to,
        errorMessage: error.message,
      });
      throw error;
    }
  }
}

export const emailService = new EmailService();
