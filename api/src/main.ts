import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import helmet from 'helmet';
import { v1RewriteMiddleware } from './common/middleware/v1-rewrite.middleware';
import { httpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { makeRateLimitMiddleware } from './common/middleware/auth-rate-limit.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // main.ts
  const instance = app.getHttpAdapter().getInstance();
  if (typeof instance?.set === 'function') {
    instance.set('trust proxy', 1);
  }

  // Rate limit auth (très important)
  app.use(
    '/auth/login',
    makeRateLimitMiddleware({ ttlSeconds: 60, limit: 10 }),
  ); // 10/min/IP
  app.use(
    '/auth/signup',
    makeRateLimitMiddleware({ ttlSeconds: 60, limit: 5 }),
  ); // 5/min/IP

  app.use(v1RewriteMiddleware);

  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new GlobalHttpExceptionFilter(),
  );
  app.use(requestIdMiddleware);
  app.use(httpLoggerMiddleware);

  app.enableCors({
    // origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('MyApp API')
    .setDescription('Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('v1/docs', app, document);

  await app.listen(3000, '0.0.0.0');
}

bootstrap();
