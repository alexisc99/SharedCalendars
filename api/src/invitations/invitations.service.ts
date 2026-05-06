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
    // 2️⃣ BLOCAGE : quota de seats atteint
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

    const invitation = await this.prisma.invitationLink.create({
      data: {
        calendarId,
        token,
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

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { isPremium: true, premiumSeats: true },
    });

    if (calendar?.isPremium && calendar.premiumSeats) {
      const membersCount = await this.prisma.calendarMember.count({
        where: { calendarId },
      });

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
}
