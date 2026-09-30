import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { MemberRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PurchasesService } from '../purchases/purchases.service';
import {
  REFERRAL_ATTRIBUTION_WINDOW_HOURS,
  REFERRAL_REWARD_DAYS,
  REFERRAL_THRESHOLD,
} from '../purchases/plans';

const GRACE_PERIOD_DAYS = 7;

// Même logique que la plupart des liens d'invitation multi-usage (Discord,
// GitHub, Slack…) : assez long pour circuler dans un groupe WhatsApp sur
// plusieurs jours, assez court pour qu'un lien oublié/leaké n'écarte pas
// indéfiniment.
const INVITATION_LINK_TTL_DAYS = 7;

// Garde-fou anti-abus (spam, tempête de notifications à chaque événement
// puisque notifyUsers() notifie tous les membres) — pas un levier de
// monétisation : volontairement généreux, aucun usage familial/amical
// normal ne devrait jamais s'en approcher. S'applique à tous les
// calendriers, y compris premium (qui peuvent avoir un plafond plus
// restrictif via premiumSeats, vérifié séparément). Relevé à 350 pour
// laisser de la marge au-dessus du plus gros palier payant (300 places).
const MAX_CALENDAR_MEMBERS = 350;

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private purchasesService: PurchasesService,
  ) {}

  async createInvitation(calendarId: string, userId: string) {
    // Vérifier que user est owner du calendrier
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
    });

    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException(
        'Only calendar owner can create invitations',
      );
    }
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      include: {
        members: true,
        groupPlan: true,
      },
    });

    if (!calendar) {
      throw new NotFoundException('Calendar not found');
    }

    // ─────────────────────────────
    // 1️⃣ GRACE PERIOD CHECK
    // ─────────────────────────────
    if (calendar.groupPlan && !calendar.isPremium) {
      const expiresAt = calendar.groupPlan.expiresAt;

      if (expiresAt) {
        const graceLimit = new Date(expiresAt);
        graceLimit.setDate(graceLimit.getDate() + GRACE_PERIOD_DAYS);

        if (new Date() > graceLimit) {
          throw new ForbiddenException(
            'This premium calendar has expired. Please renew your group plan.',
          );
        }
        // sinon → encore dans la grace period → OK
      } else {
        // sécurité : plan invalide
        throw new ForbiddenException(
          'This premium calendar is no longer active.',
        );
      }
    }
    // ─────────────────────────────
    // 2️⃣ BLOCAGE : plafond absolu (anti-abus, tous calendriers)
    // ─────────────────────────────
    if (calendar.members.length >= MAX_CALENDAR_MEMBERS) {
      throw new ForbiddenException(
        `This calendar has reached the maximum of ${MAX_CALENDAR_MEMBERS} members.`,
      );
    }

    // ─────────────────────────────
    // 3️⃣ BLOCAGE : quota de seats premium atteint (peut être plus restrictif)
    // ─────────────────────────────
    if (
      calendar.isPremium &&
      calendar.premiumSeats !== null &&
      calendar.members.length >= calendar.premiumSeats
    ) {
      throw new ForbiddenException(
        'Maximum number of members reached for this premium calendar.',
      );
    }
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITATION_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.invitationLink.create({
      data: {
        calendarId,
        token,
        expiresAt,
        createdByUserId: userId,
      },
    });

    // ─────────────────────────────
    // 4️⃣ AUDIT
    // ─────────────────────────────
    await this.auditService.log({
      userId: userId,
      action: 'CALENDAR_INVITATION_CREATED',
      entity: 'CalendarInvitation',
      entityId: invitation.id,
      metadata: {
        calendarId,
      },
    });
    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitationLink.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const calendarId = invitation.calendarId;

    // Vérifier si l'utilisateur est déjà membre (USAGE DE findUnique)
    const existing = await this.prisma.calendarMember.findUnique({
      where: {
        calendarId_userId: {
          calendarId,
          userId,
        },
      },
    });

    if (existing) {
      return { joined: true, calendarId };
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('This invitation link has expired');
    }

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { isPremium: true, premiumSeats: true },
    });

    const membersCount = await this.prisma.calendarMember.count({
      where: { calendarId },
    });

    if (membersCount >= MAX_CALENDAR_MEMBERS) {
      throw new ForbiddenException(
        `This calendar has reached the maximum of ${MAX_CALENDAR_MEMBERS} members.`,
      );
    }

    if (calendar?.isPremium && calendar.premiumSeats) {
      if (membersCount >= calendar.premiumSeats) {
        throw new ForbiddenException('Premium calendar member limit reached');
      }
    }

    // Ajouter le membre
    await this.prisma.calendarMember.create({
      data: {
        calendarId,
        userId,
        role: MemberRole.member,
      },
    });

    // Best-effort : un souci d'attribution de parrainage ne doit jamais
    // empêcher quelqu'un de rejoindre un calendrier.
    try {
      await this.attributeReferral(userId, invitation.createdByUserId);
    } catch (err) {
      console.error('[attributeReferral] failed', err);
    }

    return {
      joined: true,
      calendarId,
    };
  }

  /**
   * Parrainage : compte comme filleul un compte VRAIMENT nouveau (créé peu
   * avant d'accepter ce lien) — pas juste "quelqu'un qui rejoint un
   * calendrier de plus", sinon ça ne fait pas grandir l'app, juste
   * remplir des calendriers existants avec des comptes déjà là.
   */
  private async attributeReferral(
    newUserId: string,
    referrerId: string | null,
  ) {
    if (!referrerId || referrerId === newUserId) return;

    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
      select: { createdAt: true, referredByUserId: true },
    });
    if (!newUser || newUser.referredByUserId) return; // déjà attribué (first-touch)

    const windowMs = REFERRAL_ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000;
    if (Date.now() - newUser.createdAt.getTime() > windowMs) return;

    await this.prisma.user.update({
      where: { id: newUserId },
      data: { referredByUserId: referrerId },
    });

    const referralCount = await this.prisma.user.count({
      where: { referredByUserId: referrerId },
    });
    if (referralCount < REFERRAL_THRESHOLD) return;

    const alreadyRewarded = await this.prisma.auditLog.findFirst({
      where: {
        userId: referrerId,
        action: 'REFERRAL_REWARD_GRANTED',
        entity: 'User',
        entityId: referrerId,
      },
    });
    if (alreadyRewarded) return;

    await this.purchasesService.grantBonusDays(
      referrerId,
      REFERRAL_REWARD_DAYS,
      'referral',
    );

    await this.auditService.log({
      userId: referrerId,
      action: 'REFERRAL_REWARD_GRANTED',
      entity: 'User',
      entityId: referrerId,
      metadata: { referralCount },
    });
  }

  /** Liens actifs (non expirés) — pour que l'owner puisse voir et révoquer ce qui traîne. */
  async listInvitations(calendarId: string, userId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
    });
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException('Only calendar owner can view invitations');
    }

    return this.prisma.invitationLink.findMany({
      where: { calendarId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(
    calendarId: string,
    invitationId: string,
    userId: string,
  ) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
    });
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException('Only calendar owner can revoke invitations');
    }

    const invitation = await this.prisma.invitationLink.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.calendarId !== calendarId) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.invitationLink.delete({ where: { id: invitationId } });

    return { success: true };
  }
}
