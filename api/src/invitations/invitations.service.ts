import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { MemberRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

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
// restrictif via premiumSeats, vérifié séparément).
const MAX_CALENDAR_MEMBERS = 50;

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
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

    return {
      joined: true,
      calendarId,
    };
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
