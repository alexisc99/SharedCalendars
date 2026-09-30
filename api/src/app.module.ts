import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CalendarsModule } from './calendars/calendars.module';
import { InvitationsModule } from './invitations/invitations.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FilesModule } from './files/files.module';
import { AuditModule } from './audit/audit.module';
import { ExportsModule } from './exports/exports.module';
import { StatsModule } from './stats/stats.module';
import { GoogleModule } from './integrations/google/google.module';
import { GroupPlansModule } from './group-plans/group-plans.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerIpGuard } from './common/guards/throttler-ip.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60, // 60s
        limit: 300, // large par défaut (routes privées ok)
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CalendarsModule,
    InvitationsModule,
    EventsModule,
    NotificationsModule,
    FilesModule,
    AuditModule,
    ExportsModule,
    StatsModule,
    GoogleModule,
    GroupPlansModule,
    PurchasesModule,
    HealthModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerIpGuard }],
})
export class AppModule {}
