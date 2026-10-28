import { query } from '../config/database.js';
import { OtpRequestRecord, OtpStatus } from '../models/types.js';

/**
 * Repositorio de acceso a datos para la tabla 'otp_requests'.
 * Centraliza todas las consultas SQL garantizando el uso de parametros seguros ($1, $2, etc.).
 */
export class OtpRepository {
  /**
   * Inserta un nuevo registro de solicitud OTP con el codigo previamente hasheado.
   */
  public async create(record: {
    id: string;
    app_name: string;
    identifier: string;
    channel: string;
    otp_code: string;
    attempts: number;
    status: OtpStatus;
    expires_at: Date;
  }): Promise<OtpRequestRecord> {
    const sql = `
      INSERT INTO otp_requests (
        id,
        app_name,
        identifier,
        channel,
        otp_code,
        attempts,
        status,
        expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *;
    `;

    const values = [
      record.id,
      record.app_name,
      record.identifier,
      record.channel,
      record.otp_code,
      record.attempts,
      record.status,
      record.expires_at,
    ];

    const result = await query<OtpRequestRecord>(sql, values);
    return result.rows[0];
  }

  /**
   * Busca el registro OTP pendiente mas reciente para una aplicacion e identificador especifico.
   */
  public async findLatestPending(appName: string, identifier: string): Promise<OtpRequestRecord | null> {
    const sql = `
      SELECT *
      FROM otp_requests
      WHERE app_name = $1
        AND identifier = $2
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const result = await query<OtpRequestRecord>(sql, [appName, identifier]);
    return result.rows[0] || null;
  }

  /**
   * Actualiza el estado de una solicitud OTP (ej. 'verified' o 'expired').
   */
  public async updateStatus(id: string, status: OtpStatus): Promise<void> {
    const sql = `
      UPDATE otp_requests
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2;
    `;

    await query(sql, [status, id]);
  }

  /**
   * Incrementa el contador de intentos fallidos.
   * Si 'newStatus' se especifica, actualiza tambien el status (ej. 'expired').
   */
  public async updateAttempts(id: string, attempts: number, newStatus?: OtpStatus): Promise<void> {
    if (newStatus) {
      const sql = `
        UPDATE otp_requests
        SET attempts = $1,
            status = $2,
            updated_at = NOW()
        WHERE id = $3;
      `;
      await query(sql, [attempts, newStatus, id]);
    } else {
      const sql = `
        UPDATE otp_requests
        SET attempts = $1,
            updated_at = NOW()
        WHERE id = $2;
      `;
      await query(sql, [attempts, id]);
    }
  }
}

export const otpRepository = new OtpRepository();
