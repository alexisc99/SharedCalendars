import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = req.originalUrl || req.url;

    const requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      (req as any).requestId ??
      undefined;

    // Default mapping
    let statusCode = HttpStatus.BAD_REQUEST;
    let message: any = 'Database error';
    let error = 'Bad Request';

    // Common Prisma codes
    // P2002: Unique constraint failed
    if (exception.code === 'P2002') {
      statusCode = HttpStatus.CONFLICT;
      error = 'Conflict';
      message = 'Unique constraint violation';
    }

    // P2025: Record not found
    if (exception.code === 'P2025') {
      statusCode = HttpStatus.NOT_FOUND;
      error = 'Not Found';
      message = 'Record not found';
    }

    return res.status(statusCode).json({
      statusCode,
      error,
      message,
      path,
      timestamp,
      prisma: {
        code: exception.code,
      },
      ...(requestId ? { requestId } : {}),
    });
  }
}
