import type { NextFunction, Request, Response } from 'express';

/**
 * Permet d'appeler l'API en /v1/... sans casser les routes existantes.
 * /v1/events/123/detail => /events/123/detail
 */
export function v1RewriteMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const url = req.url;

  if (url === '/v1') {
    req.url = '/';
    return next();
  }

  if (url.startsWith('/v1/')) {
    req.url = url.slice(3); // enlève "/v1"
  }

  next();
}
