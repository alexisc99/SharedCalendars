import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MemberRole } from '@prisma/client';

@Injectable()
export class GroupPlansService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * DEV / INTERNE
   * Provisionne un plan groupe + calendrier premium associé
   */
  async provisionDev(ownerId: string, seats: number = 6) {
    const existing = await this.prisma.groupPlan.findFirst({
      where: {
        ownerId,
        isActive: true,
      },
    });

    if (existing) {
      throw new ForbiddenException('Active group plan already exists');
    }

    // 1️⃣ Créer le plan
    const plan = await this.prisma.groupPlan.create({
      data: {
        ownerId,
        seats,
        isActive: true,
      },
    });

    // 2️⃣ Créer le calendrier premium
    const calendar = await this.prisma.calendar.create({
      data: {
        name: 'Calendrier Famille',
        isPremium: true,
        premiumSeats: seats,
        owner: {
          connect: { id: ownerId },
        },
        members: {
          create: {
            user: { connect: { id: ownerId } },
            role: MemberRole.owner,
          },
        },
        groupPlan: {
          connect: { id: plan.id },
        },
      },
    });

    // 3️⃣ Lier le plan au calendrier
    await this.prisma.groupPlan.update({
      where: { id: plan.id },
      data: { calendarId: calendar.id },
    });

    // 4️⃣ AUDIT
    await this.auditService.log({
      userId: ownerId,
      action: 'GROUP_PLAN_CREATED',
      entity: 'GroupPlan',
      entityId: plan.id,
      metadata: {
        calendarId: calendar.id,
        seats,
      },
    });

    return {
      planId: plan.id,
      calendarId: calendar.id,
      premiumSeats: seats,
    };
  }

  /**
   * Vrai chemin d'achat : passe un calendrier EXISTANT en premium (au
   * contraire de provisionDev, qui crée toujours un calendrier tout neuf —
   * pratique pour tester vite, mais inutilisable pour un achat réel : on
   * veut rendre premium le calendrier qu'on a déjà, pas en créer un vide).
   */
  async purchaseForCalendar(params: {
    ownerId: string;
    calendarId: string;
    seats: number;
    expiresAt: Date;
    provider: string;
    providerRef: string;
  }) {
    const { ownerId, calendarId, seats, expiresAt, provider, providerRef } =
      params;

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      include: { groupPlan: true },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');
    if (calendar.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the calendar owner can purchase premium for it',
      );
    }
    if (calendar.groupPlan && calendar.groupPlan.isActive) {
      throw new ForbiddenException(
        'This calendar already has an active group plan',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const plan = calendar.groupPlan
        ? await tx.groupPlan.update({
            where: { id: calendar.groupPlan.id },
            data: { seats, isActive: true, expiresAt, provider, providerRef },
          })
        : await tx.groupPlan.create({
            data: {
              ownerId,
              calendarId,
              seats,
              isActive: true,
              expiresAt,
              provider,
              providerRef,
            },
          });

      const updatedCalendar = await tx.calendar.update({
        where: { id: calendarId },
        data: {
          isPremium: true,
          premiumSeats: seats,
          groupPlanId: plan.id,
        },
      });

      return { plan, calendar: updatedCalendar };
    });

    await this.auditService.log({
      userId: ownerId,
      action: 'GROUP_PLAN_CREATED',
      entity: 'GroupPlan',
      entityId: result.plan.id,
      metadata: { calendarId, seats },
    });

    return {
      planId: result.plan.id,
      calendarId,
      premiumSeats: seats,
      expiresAt,
    };
  }

  /**
   * Downgrade manuel ou automatique (expiration)
   */
  async downgrade(planId: string, reason: 'MANUAL' | 'EXPIRED' = 'MANUAL') {
    const plan = await this.prisma.groupPlan.findUnique({
      where: { id: planId },
      include: { calendar: true },
    });

    if (!plan || !plan.isActive) {
      throw new ForbiddenException('Plan already inactive or not found');
    }

    // 1️⃣ Désactiver le calendrier premium
    if (plan.calendar) {
      await this.prisma.calendar.update({
        where: { id: plan.calendar.id },
        data: {
          isPremium: false,
          premiumSeats: null,
        },
      });
    }

    // 2️⃣ Désactiver le plan
    await this.prisma.groupPlan.update({
      where: { id: planId },
      data: {
        isActive: false,
      },
    });

    // 3️⃣ AUDIT
    await this.auditService.log({
      userId: plan.ownerId,
      action:
        reason === 'EXPIRED' ? 'GROUP_PLAN_EXPIRED' : 'GROUP_PLAN_DOWNGRADED',
      entity: 'GroupPlan',
      entityId: planId,
      metadata: {
        calendarId: plan.calendar?.id,
        reason,
      },
    });

    return {
      planId,
      calendarId: plan.calendar?.id,
      status: 'DOWNGRADED',
      reason,
    };
  }

  /**
   * Renew / Reactivate a group plan (DEV now, production later via payment webhook).
   * - Reactivates the plan
   * - Updates expiration (required)
   * - Re-enables premium on the linked calendar
   */
  async renew(params: {
    planId: string;
    renewedByUserId: string;
    newExpiresAt: Date;
    newSeats?: number;
  }) {
    const { planId, renewedByUserId, newExpiresAt, newSeats } = params;

    const plan = await this.prisma.groupPlan.findUnique({
      where: { id: planId },
      include: { calendar: true },
    });

    if (!plan) throw new NotFoundException('Group plan not found');

    if (!plan.calendar) {
      // With 1↔1 design, this should never happen; but fail safe.
      throw new ForbiddenException('Group plan has no calendar linked');
    }

    // Optional: only owner can renew in DEV endpoint
    if (plan.ownerId !== renewedByUserId) {
      throw new ForbiddenException(
        'Only the plan owner can renew this group plan',
      );
    }

    if (
      !(newExpiresAt instanceof Date) ||
      Number.isNaN(newExpiresAt.getTime())
    ) {
      throw new ForbiddenException('Invalid newExpiresAt');
    }
    const membersCount = await this.prisma.calendarMember.count({
      where: { calendarId: plan.calendar.id },
    });

    const seatsToApply = typeof newSeats === 'number' ? newSeats : plan.seats;

    if (seatsToApply < membersCount) {
      throw new ForbiddenException(
        `Seats cannot be lower than current members (${membersCount}). Remove members or renew with more seats.`,
      );
    }

    if (seatsToApply <= 0 || seatsToApply > 50) {
      // Guardrail, can be adjusted later
      throw new ForbiddenException('Invalid seats value');
    }

    // Transaction: keep consistency plan <-> calendar
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.groupPlan.update({
        where: { id: planId },
        data: {
          isActive: true,
          expiresAt: newExpiresAt,
          seats: seatsToApply,
        },
      });

      const updatedCalendar = await tx.calendar.update({
        where: { id: plan.calendar!.id },
        data: {
          isPremium: true,
          premiumSeats: seatsToApply,
          // groupPlanId should already be set in the premium calendar model;
          // if you nulled it during downgrade, you can reattach here:
          groupPlanId: planId,
        },
      });

      return { updatedPlan, updatedCalendar };
    });

    await this.auditService.log({
      userId: renewedByUserId,
      action: 'GROUP_PLAN_RENEWED',
      entity: 'GroupPlan',
      entityId: planId,
      metadata: {
        calendarId: result.updatedCalendar.id,
        expiresAt: result.updatedPlan.expiresAt?.toISOString?.() ?? null,
        seats: result.updatedPlan.seats,
      },
    });

    return {
      planId,
      calendarId: result.updatedCalendar.id,
      isActive: result.updatedPlan.isActive,
      expiresAt: result.updatedPlan.expiresAt,
      seats: result.updatedPlan.seats,
    };
  }
}
