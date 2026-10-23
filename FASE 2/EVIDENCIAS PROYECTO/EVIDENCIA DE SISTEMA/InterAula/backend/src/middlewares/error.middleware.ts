import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Registrar el error internamente sin filtrar secretos
  console.error('[API Error Handler]:', err.message || err);

  const status = typeof err.status === 'number' ? err.status : 500;
  const message = err.message || 'Ha ocurrido un error inesperado en el servidor.';

  res.status(status).json({
    success: false,
    error: message,
    ...(env.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
}
