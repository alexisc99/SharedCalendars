import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupPlansService } from './group-plans.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from 'src/audit/audit.types';

@Injectable()
export class GroupPlanExpirationService {
  private readonly logger = new Logger(GroupPlanExpirationService.name);

  constructor(
    private prisma: PrismaService,
    private groupPlansService: GroupPlansService,
    private auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleGroupPlansLifecycle() {
    const now = new Date();

    const plans = await this.prisma.groupPlan.findMany({
      where: {
        expiresAt: { not: null },
      },
      include: {
        calendar: true,
      },
    });

    for (const plan of plans) {
      if (!plan.expiresAt) continue;

      const diffMs = plan.expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // ─────────────────────────────
      // J-3 WARNING
      // ─────────────────────────────
      if (diffDays === 3) {
        await this.notifyOnce(
          plan,
          'GROUP_PLAN_EXPIRY_WARNING',
          'Your group plan will expire in 3 days.',
        );
      }

      // ─────────────────────────────
      // J-0 EXPIRATION
      // ─────────────────────────────
      if (diffDays <= 0 && plan.isActive) {
        await this.groupPlansService.downgrade(plan.id, 'EXPIRED');

        await this.notifyOnce(
          plan,
          'GROUP_PLAN_EXPIRED_NOTICE',
          'Your group plan has expired.',
        );
      }

      // ─────────────────────────────
      // J+5 FINAL REMINDER
      // ─────────────────────────────
      if (diffDays === -5) {
        await this.notifyOnce(
          plan,
          'GROUP_PLAN_FINAL_REMINDER',
          'Your group plan grace period is almost over.',
        );
      }
    }
  }

  /**
   * Empêche l’envoi multiple de la même notification
   */
  private async notifyOnce(plan: any, action: AuditAction, message: string) {
    const alreadySent = await this.prisma.auditLog.findFirst({
      where: {
        action,
        entity: 'GroupPlan',
        entityId: plan.id,
      },
    });

    if (alreadySent) return;

    // Notification interne
    await this.prisma.notification.create({
      data: {
        userId: plan.ownerId,
        type: 'SYSTEM',
        title: 'Group plan expiration',
        message,
      },
    });

    // Audit
    await this.auditService.log({
      userId: plan.ownerId,
      action,
      entity: 'GroupPlan',
      entityId: plan.id,
      metadata: {
        calendarId: plan.calendar?.id,
      },
    });

    this.logger.log(`${action} sent for plan ${plan.id}`);
  }
}
