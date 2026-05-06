import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService, AuditService],
})
export class InvitationsModule {}
