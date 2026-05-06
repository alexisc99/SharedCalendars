import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditController } from './audit.controller';

@Module({
  controllers: [AuditController],
  providers: [AuditService, PrismaService],
  exports: [AuditService],
})
export class AuditModule {}
