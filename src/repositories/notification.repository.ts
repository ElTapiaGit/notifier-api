import { query } from '../config/database.js';
import { NotificationLogRecord, NotificationStatus } from '../models/types.js';

/**
 * Repositorio de acceso a datos para la tabla 'notification_logs'.
 * Registra todas las transacciones de envio de notificaciones (exitosas y fallidas).
 */
export class NotificationRepository {
  /**
   * Inserta un nuevo registro de auditoria en notification_logs.
   */
  public async createLog(record: {
    id: string;
    app_name: string;
    identifier: string;
    channel: string;
    template_used: string;
    status: NotificationStatus;
    error_message?: string | null;
  }): Promise<NotificationLogRecord> {
    const sql = `
      INSERT INTO notification_logs (
        id,
        app_name,
        identifier,
        channel,
        template_used,
        status,
        error_message,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *;
    `;

    const values = [
      record.id,
      record.app_name,
      record.identifier,
      record.channel,
      record.template_used,
      record.status,
      record.error_message || null,
    ];

    const result = await query<NotificationLogRecord>(sql, values);
    return result.rows[0];
  }
}

export const notificationRepository = new NotificationRepository();
