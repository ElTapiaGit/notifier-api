import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../config/logger.js';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Servicio criptografico para generacion segura de codigos OTP y hashing de credenciales.
 */
export class CryptoService {
  /**
   * Genera un codigo OTP numerico de 6 digitos utilizando un generador criptograficamente seguro (CSPRNG).
   * Rango garantizado: [100000, 999999].
   */
  public static generateOtpCode(): string {
    const min = 100000;
    const max = 1000000; // Limite superior exclusivo en randomInt para obtener hasta 999999
    const codeNumber = crypto.randomInt(min, max);
    return codeNumber.toString().padStart(6, '0');
  }

  /**
   * Genera un UUID v4 criptograficamente seguro.
   */
  public static generateUuid(): string {
    return crypto.randomUUID();
  }

  /**
   * Genera el hash de un codigo OTP utilizando bcrypt.
   * Garantiza que ningun codigo OTP se almacene en texto plano en la base de datos.
   */
  public static async hashOtp(plainCode: string): Promise<string> {
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(plainCode, salt);
  }

  /**
   * Compara un codigo OTP en texto plano contra el hash almacenado en la base de datos.
   */
  public static async verifyOtpHash(plainCode: string, hashedCode: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainCode, hashedCode);
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Error durante la comparacion del hash de OTP', {
        errorMessage: error.message,
      });
      return false;
    }
  }

  /**
   * Realiza una comparacion en tiempo constante para mitigar ataques de temporizacion (timing attacks).
   * Utilizado para la validacion del encabezado x-api-key contra la variable API_SECRET_KEY.
   */
  public static timingSafeCompare(knownValue: string, candidateValue: string): boolean {
    if (!knownValue || !candidateValue) {
      return false;
    }

    const knownBuffer = Buffer.from(knownValue, 'utf8');
    const candidateBuffer = Buffer.from(candidateValue, 'utf8');

    if (knownBuffer.length !== candidateBuffer.length) {
      // Para evitar filtrar la longitud exacta inmediatamente, ejecutamos un buffer falso en tiempo constante
      crypto.timingSafeEqual(knownBuffer, knownBuffer);
      return false;
    }

    return crypto.timingSafeEqual(knownBuffer, candidateBuffer);
  }
}
