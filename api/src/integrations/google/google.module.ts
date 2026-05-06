import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleCallbackController } from './google.callback.controller';
import { JwtService } from '@nestjs/jwt';
import { GoogleWebhookController } from './google.webhook.controller';
import { AuditService } from '../../audit/audit.service';

@Module({
  providers: [GoogleService, PrismaService, JwtService, AuditService],
  controllers: [
    GoogleController,
    GoogleCallbackController,
    GoogleWebhookController,
  ],
})
export class GoogleModule {}
