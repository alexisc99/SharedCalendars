import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupPlansService } from './group-plans.service';
import { GroupPlansController } from './group-plans.controller';
import { AuditService } from '../audit/audit.service';
import { GroupPlanExpirationService } from './group-plan-expiration.service';

@Module({
  controllers: [GroupPlansController],
  providers: [
    GroupPlansService,
    PrismaService,
    AuditService,
    GroupPlanExpirationService,
  ],
})
export class GroupPlansModule {}
