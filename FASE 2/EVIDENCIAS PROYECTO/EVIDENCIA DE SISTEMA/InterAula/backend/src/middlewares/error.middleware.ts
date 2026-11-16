import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ success: false, error: 'Datos de solicitud inválidos o incompletos.',
      details: err.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) });
    return;
  }
  // Registrar el error internamente sin filtrar secretos
  console.error('[API Error Handler]:', err.message || err);

  const status = typeof err.status === 'number' && err.status >= 400 && err.status <= 599 ? err.status : 500;
  const message = err instanceof HttpError || status < 500
    ? err.message
    : 'No fue posible completar la operación. Intenta nuevamente.';

  res.status(status).json({
    success: false,
    error: message,
    ...(err instanceof HttpError && err.code ? { details: { code: err.code } } : {}),
    ...(env.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
}
