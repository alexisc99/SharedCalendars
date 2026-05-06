import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : randomUUID();

  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
