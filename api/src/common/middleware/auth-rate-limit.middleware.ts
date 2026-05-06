import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const ipFromXff =
    typeof xff === 'string'
      ? xff.split(',')[0].trim()
      : Array.isArray(xff)
        ? String(xff[0] ?? '')
            .split(',')[0]
            .trim()
        : '';

  return (
    ipFromXff ||
    req.ip ||
    req.socket?.remoteAddress ||
    // @ts-ignore legacy
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * Rate limit simple in-memory (par IP).
 * - ttlSeconds: fenêtre de temps
 * - limit: nombre max de requêtes dans la fenêtre
 */
export function makeRateLimitMiddleware(opts: {
  ttlSeconds: number;
  limit: number;
}) {
  const buckets = new Map<string, Bucket>();

  // nettoyage périodique pour éviter que la Map gonfle
  const SWEEP_EVERY_MS = 60_000;
  let lastSweep = Date.now();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();

    if (now - lastSweep > SWEEP_EVERY_MS) {
      lastSweep = now;
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }

    const ip = getClientIp(req);
    const key = ip; // tu peux ajouter user-agent si tu veux, mais IP suffit

    const ttlMs = opts.ttlSeconds * 1000;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + ttlMs;
      buckets.set(key, { count: 1, resetAt });

      res.setHeader('X-RateLimit-Limit', String(opts.limit));
      res.setHeader('X-RateLimit-Remaining', String(opts.limit - 1));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      return next();
    }

    bucket.count += 1;

    const remaining = Math.max(0, opts.limit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(opts.limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    if (bucket.count > opts.limit) {
      return res.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many attempts, please try again later.',
        path: req.originalUrl || req.url,
        timestamp: new Date().toISOString(),
      });
    }

    return next();
  };
}
