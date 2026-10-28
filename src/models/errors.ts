/**
 * Jerarquia de errores de la aplicacion para respuestas HTTP estandarizadas y seguras.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly remainingAttempts?: number;

  constructor(message: string, statusCode = 500, remainingAttempts?: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.remainingAttempts = remainingAttempts;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, remainingAttempts?: number) {
    super(message, 401, remainingAttempts);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class BadGatewayError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}
