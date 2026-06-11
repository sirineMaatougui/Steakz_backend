/** Operational error carrying an HTTP status code, handled centrally. */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const badRequest = (m: string): AppError => new AppError(400, m);
export const unauthorized = (m = 'Unauthorized'): AppError => new AppError(401, m);
export const forbidden = (m = 'Forbidden'): AppError => new AppError(403, m);
export const notFound = (m = 'Resource not found'): AppError => new AppError(404, m);
export const conflict = (m: string): AppError => new AppError(409, m);
