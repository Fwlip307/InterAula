import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';

export function createRateLimiter(limit = 30, windowMs = 60_000) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    const key = (req as AuthenticatedRequest).user?.id || req.ip || 'unknown';
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ success: false, error: 'Has realizado demasiadas solicitudes. Espera un momento e inténtalo nuevamente.' });
      return;
    }
    next();
  };
}
