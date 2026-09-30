import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GroupPlansService } from '../group-plans/group-plans.service';
import { PAYMENT_PROVIDER } from './payment-provider';
import type { PaymentProvider } from './payment-provider';
import {
  BillingPeriod,
  GROUP_SEAT_TIERS,
  INDIVIDUAL_PLAN,
  REFERRAL_REWARD_DAYS,
  REFERRAL_THRESHOLD,
  TRIAL_DAYS,
  groupPeriodDays,
  groupPriceCents,
} from './plans';

const MIN_GROUP_SEATS = 2;
const MAX_GROUP_SEATS = 300;

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private groupPlansService: GroupPlansService,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProvider,
  ) {}

  getPlans() {
    return {
      individual: INDIVIDUAL_PLAN,
      groupTiers: GROUP_SEAT_TIERS,
      trialDays: TRIAL_DAYS,
    };
  }

  async getMyStatus(userId: string) {
    const [individualSub, ownedPlans, hasUsedTrial, referralCount, referralRewarded] =
      await Promise.all([
        this.prisma.userSubscription.findFirst({
          where: { userId, isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.groupPlan.findMany({
          where: { ownerId: userId, isActive: true },
          include: { calendar: { select: { id: true, name: true } } },
        }),
        this.prisma.userSubscription.findFirst({
          where: { userId, provider: 'trial' },
          select: { id: true },
        }),
        this.prisma.user.count({ where: { referredByUserId: userId } }),
        this.prisma.auditLog.findFirst({
          where: {
            userId,
            action: 'REFERRAL_REWARD_GRANTED',
            entity: 'User',
            entityId: userId,
          },
          select: { id: true },
        }),
      ]);

    return {
      individual: individualSub
        ? {
            subscriptionId: individualSub.id,
            provider: individualSub.provider,
            expiresAt: individualSub.expiresAt,
            canceledAt: individualSub.canceledAt,
          }
        : null,
      trialAvailable: !hasUsedTrial,
      referral: {
        count: referralCount,
        threshold: REFERRAL_THRESHOLD,
        rewardDays: REFERRAL_REWARD_DAYS,
        rewardGranted: !!referralRewarded,
      },
      groupPlans: ownedPlans.map((p) => ({
        planId: p.id,
        calendarId: p.calendarId,
        calendarName: p.calendar?.name ?? null,
        seats: p.seats,
        expiresAt: p.expiresAt,
        canceledAt: p.canceledAt,
      })),
    };
  }

  // ─────────────────────────────
  // ESSAI GRATUIT — 14 jours, une fois par compte, déclenché à la demande
  // (pas lié à une fonctionnalité précise) plutôt qu'un mur.
  // ─────────────────────────────

  async startTrial(userId: string) {
    const alreadyUsed = await this.prisma.userSubscription.findFirst({
      where: { userId, provider: 'trial' },
    });
    if (alreadyUsed) {
      throw new ForbiddenException('Trial already used for this account');
    }

    const activeSub = await this.prisma.userSubscription.findFirst({
      where: { userId, isActive: true },
    });
    if (activeSub) {
      throw new ForbiddenException('You already have an active subscription');
    }

    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userSubscription.create({
        data: { userId, isActive: true, expiresAt, provider: 'trial' },
      });
      await tx.user.update({
        where: { id: userId },
        data: { isPremium: true },
      });
      return created;
    });

    await this.auditService.log({
      userId,
      action: 'SUBSCRIPTION_PURCHASED',
      entity: 'UserSubscription',
      entityId: sub.id,
      metadata: { provider: 'trial', expiresAt: expiresAt.toISOString() },
    });

    return { subscriptionId: sub.id, expiresAt };
  }

  // ─────────────────────────────
  // BONUS (parrainage, etc.) — prolonge un abonnement actif, ou en ouvre un
  // sans passer par le prestataire de paiement puisqu'aucun argent ne
  // change de main.
  // ─────────────────────────────

  async grantBonusDays(userId: string, days: number, provider: string) {
    const active = await this.prisma.userSubscription.findFirst({
      where: { userId, isActive: true },
      orderBy: { expiresAt: 'desc' },
    });

    const base = active?.expiresAt && active.expiresAt > new Date() ? active.expiresAt : new Date();
    const expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    if (active) {
      await this.prisma.userSubscription.update({
        where: { id: active.id },
        data: { expiresAt },
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.userSubscription.create({
          data: { userId, isActive: true, expiresAt, provider },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { isPremium: true },
        }),
      ]);
    }
  }

  // ─────────────────────────────
  // INDIVIDUEL
  // ─────────────────────────────

  async purchaseIndividual(userId: string) {
    const existing = await this.prisma.userSubscription.findFirst({
      where: { userId, isActive: true },
    });
    if (existing) {
      throw new ForbiddenException(
        'You already have an active individual subscription',
      );
    }

    const { providerRef } = await this.paymentProvider.purchase({
      userId,
      planId: INDIVIDUAL_PLAN.id,
    });
    const expiresAt = new Date(
      Date.now() + INDIVIDUAL_PLAN.periodDays * 24 * 60 * 60 * 1000,
    );

    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userSubscription.create({
        data: {
          userId,
          isActive: true,
          expiresAt,
          provider: this.paymentProvider.name,
          providerRef,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { isPremium: true },
      });
      return created;
    });

    await this.auditService.log({
      userId,
      action: 'SUBSCRIPTION_PURCHASED',
      entity: 'UserSubscription',
      entityId: sub.id,
      metadata: { planId: INDIVIDUAL_PLAN.id, expiresAt: expiresAt.toISOString() },
    });

    return { subscriptionId: sub.id, expiresAt };
  }

  async cancelIndividual(userId: string) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, isActive: true },
    });
    if (!sub) throw new NotFoundException('No active individual subscription');
    if (sub.canceledAt) return { canceledAt: sub.canceledAt, activeUntil: sub.expiresAt };

    await this.paymentProvider.cancel({ providerRef: sub.providerRef ?? '' });

    // Reste actif jusqu'à expiresAt — comme un vrai abonnement, on ne coupe
    // pas l'accès déjà payé. Le cron d'expiration désactivera isPremium à
    // l'échéance (GroupPlanExpirationService.handleUserSubscriptionsLifecycle).
    const canceledAt = new Date();
    await this.prisma.userSubscription.update({
      where: { id: sub.id },
      data: { canceledAt },
    });

    await this.auditService.log({
      userId,
      action: 'SUBSCRIPTION_CANCELED',
      entity: 'UserSubscription',
      entityId: sub.id,
      metadata: { expiresAt: sub.expiresAt?.toISOString() ?? null },
    });

    return { canceledAt, activeUntil: sub.expiresAt };
  }

  // ─────────────────────────────
  // GROUPE
  // ─────────────────────────────

  async purchaseGroup(
    userId: string,
    calendarId: string,
    seatsInput: number | undefined,
    period: BillingPeriod = 'monthly',
  ) {
    const seats = seatsInput ?? GROUP_SEAT_TIERS[0].maxSeats;

    if (seats < MIN_GROUP_SEATS || seats > MAX_GROUP_SEATS) {
      throw new ForbiddenException(
        `Seats must be between ${MIN_GROUP_SEATS} and ${MAX_GROUP_SEATS}`,
      );
    }

    const priceCents = groupPriceCents(seats, period); // valide aussi le palier
    const planId = `group_${period}_${seats}seats`;

    const { providerRef } = await this.paymentProvider.purchase({
      userId,
      planId,
    });
    const expiresAt = new Date(
      Date.now() + groupPeriodDays(period) * 24 * 60 * 60 * 1000,
    );

    const result = await this.groupPlansService.purchaseForCalendar({
      ownerId: userId,
      calendarId,
      seats,
      expiresAt,
      provider: this.paymentProvider.name,
      providerRef,
    });

    return { ...result, priceCents, period };
  }

  async cancelGroup(userId: string, calendarId: string) {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      include: { groupPlan: true },
    });
    if (!calendar?.groupPlan || !calendar.groupPlan.isActive) {
      throw new NotFoundException('No active group plan for this calendar');
    }
    if (calendar.ownerId !== userId) {
      throw new ForbiddenException('Only the calendar owner can cancel');
    }
    if (calendar.groupPlan.canceledAt) {
      return {
        canceledAt: calendar.groupPlan.canceledAt,
        activeUntil: calendar.groupPlan.expiresAt,
      };
    }

    await this.paymentProvider.cancel({
      providerRef: calendar.groupPlan.providerRef ?? '',
    });

    // Même logique que l'individuel : reste premium jusqu'à expiresAt, le
    // cron désactive à l'échéance (pas de downgrade() immédiat ici, qui est
    // réservé à l'expiration réelle / à une action admin).
    const canceledAt = new Date();
    await this.prisma.groupPlan.update({
      where: { id: calendar.groupPlan.id },
      data: { canceledAt },
    });

    await this.auditService.log({
      userId,
      action: 'SUBSCRIPTION_CANCELED',
      entity: 'GroupPlan',
      entityId: calendar.groupPlan.id,
      metadata: {
        calendarId,
        expiresAt: calendar.groupPlan.expiresAt?.toISOString() ?? null,
      },
    });

    return { canceledAt, activeUntil: calendar.groupPlan.expiresAt };
  }
}
