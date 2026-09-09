import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = req.originalUrl || req.url;

    const requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      (req as any).requestId ??
      undefined;

    // HttpException (BadRequest, Forbidden, etc.)
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      // Nest response can be string or object { message, error, statusCode }
      let message: any = exception.message;
      let error = HttpStatus[statusCode] ?? 'Error';

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const r: any = response;
        if (r.message !== undefined) message = r.message;
        if (r.error !== undefined) error = r.error;
      }

      return res.status(statusCode).json({
        statusCode,
        error,
        message,
        path,
        timestamp,
        ...(requestId ? { requestId } : {}),
      });
    }

    // Unknown / unhandled error
    // Avoid leaking internal error details to the CLIENT in prod (message
    // stays generic below), but always log the real cause server-side —
    // sinon un 500 est totalement muet, y compris pour nous en dev.
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      `${req.method} ${path} — ${(exception as any)?.message ?? exception}`,
      (exception as any)?.stack,
    );

    return res.status(statusCode).json({
      statusCode,
      error: 'Internal Server Error',
      message: 'Unexpected error',
      path,
      timestamp,
      ...(requestId ? { requestId } : {}),
    });
  }
}
