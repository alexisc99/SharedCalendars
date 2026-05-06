import type { NextFunction, Request, Response } from 'express';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-google-auth',
]);

function sanitizeHeaders(headers: Request['headers']) {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(key)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v as any;
    }
  }
  return out;
}

function isSensitivePath(path: string) {
  // évite de logger body / infos sensibles sur auth & oauth
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/signup') ||
    path.startsWith('/integrations/google/callback') ||
    path.startsWith('/integrations/google/connect')
  );
}
function sanitizePath(path: string) {
  // masque le token ICS public dans les logs
  // /public/calendars/<token>/ics -> /public/calendars/[token]/ics
  return path.replace(
    /\/public\/calendars\/[^\/]+\/ics/g,
    '/public/calendars/[token]/ics',
  );
}

export function httpLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = Date.now();

  // requestId si tu l’as déjà via ton middleware
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ||
    (req as any).requestId;

  const method = req.method;
  const rawPath = req.originalUrl || req.url;
  const path = sanitizePath(rawPath);

  // Important : pas de body loggué ici
  const headers = sanitizeHeaders(req.headers);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;

    const base = {
      requestId,
      method,
      path,
      status,
      ms,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    // Log headers uniquement si utile; sinon tu peux commenter cette ligne
    const extra = isSensitivePath(path) ? {} : { headers };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ...base, ...extra }));
  });

  next();
}
