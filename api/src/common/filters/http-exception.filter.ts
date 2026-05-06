import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
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
    // Avoid leaking internal error details in prod; keep message generic
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

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
