import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RsvpService } from './rsvp.service';
import { RsvpController } from './rsvp.controller';
import { PollService } from './poll.service';
import { PollController } from './poll.controller';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
@Module({
  imports: [NotificationsModule, PermissionsModule, AuditModule],

  controllers: [
    EventsController,
    RsvpController,
    PollController,
    CommentController,
  ],
  providers: [
    EventsService,
    PrismaService,
    RsvpService,
    PollService,
    CommentService,
  ],
})
export class EventsModule {}
