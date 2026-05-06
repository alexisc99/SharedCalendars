import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { MemberRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CalendarHomeDto } from './dto/calendar-home.dto';

@Injectable()
export class CalendarsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCalendarDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const isPremium = user.isPremium;

    // 1) Freemium: max 3 calendars
    if (!isPremium) {
      const count = await this.prisma.calendar.count({
        where: { ownerId: userId },
      });
      if (count >= 3) {
        throw new ForbiddenException(
          'Freemium users can only create up to 3 calendars',
        );
      }
    }

    // 2) Themes premium
    const PREMIUM_THEMES = ['gold', 'night-sky', 'gradient-purple'];
    const FREE_THEMES = ['default', 'blue', 'green', 'red'];

    if (dto.theme) {
      const isPremiumTheme = PREMIUM_THEMES.includes(dto.theme);
      if (isPremiumTheme && !isPremium) {
        throw new ForbiddenException('This theme requires a premium account');
      }
      if (!isPremiumTheme && !FREE_THEMES.includes(dto.theme)) {
        throw new ForbiddenException('Unknown theme');
      }
    }

    // 3) Cover image premium
    if (dto.coverImageUrl && !isPremium) {
      throw new ForbiddenException('Cover images require a premium account');
    }
    return this.prisma.calendar.create({
      data: {
        name: dto.name,
        color: dto.color ?? 'blue',
        theme: dto.theme ?? 'default',
        coverImageUrl: dto.coverImageUrl ?? null,

        // Lier l'owner via la relation
        owner: {
          connect: { id: userId },
        },

        // Créer en même temps l'enregistrement CalendarMember pour l'owner
        members: {
          create: {
            user: { connect: { id: userId } },
            role: MemberRole.owner,
          },
        },
      },
    });
  }

  async findUserCalendars(userId: string) {
    return this.prisma.calendar.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: true,
      },
    });
  }
  async findUserCalendarsSummary(userId: string) {
    const memberships = await this.prisma.calendarMember.findMany({
      where: { userId },
      select: {
        role: true,
        calendar: {
          select: {
            id: true,
            name: true,
            color: true,
            theme: true,
            isPremium: true,
            publicIcsEnabled: true,
            createdAt: true,
            _count: {
              select: {
                members: true,
                events: true,
              },
            },
          },
        },
      },
      orderBy: { calendar: { createdAt: 'desc' } },
    });

    return memberships.map((m) => ({
      id: m.calendar.id,
      name: m.calendar.name,
      color: m.calendar.color,
      theme: m.calendar.theme,
      isPremium: m.calendar.isPremium,
      publicIcsEnabled: m.calendar.publicIcsEnabled,
      role: m.role,
      membersCount: m.calendar._count.members,
      eventsCount: m.calendar._count.events,
      createdAt: m.calendar.createdAt,
    }));
  }

  async findOne(calendarId: string, userId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }

    return this.prisma.calendar.findUnique({
      where: { id: calendarId },
      include: {
        members: true,
        events: true,
      },
    });
  }

  async getCalendarHome(
    userId: string,
    calendarId: string,
  ): Promise<CalendarHomeDto> {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('No access to this calendar');

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: {
        id: true,
        name: true,
        color: true,
        theme: true,
        isPremium: true,
        premiumSeats: true,
        publicIcsEnabled: true,
        syncMode: true,
        groupPlan: { select: { seats: true } },
        _count: { select: { members: true } },
      },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');

    const upcomingEvents = await this.prisma.event.findMany({
      where: {
        calendarId,
        status: 'PUBLISHED',
        startDateTime: { gte: new Date() },
      },
      orderBy: { startDateTime: 'asc' },
      take: 10,
      select: {
        id: true,
        title: true,
        startDateTime: true,
        endDateTime: true,
      },
    });

    // activity via AuditLog (simple)
    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'Calendar', entityId: calendarId },
          { metadata: { path: ['calendarId'], equals: calendarId } as any },
        ],
        createdAt: { gte: since30 },
      },
      select: { action: true, createdAt: true },
    });

    const agg = (since: Date) => {
      const f = logs.filter((l) => l.createdAt >= since);
      return {
        events: f.filter((l) => l.action.startsWith('EVENT')).length,
        comments: f.filter((l) => l.action === 'COMMENT_ADDED').length,
        files: f.filter((l) => l.action === 'FILE_UPLOADED').length,
      };
    };

    const last7d = agg(since7);
    const last30d = agg(since30);

    const seatsTotal = calendar.groupPlan?.seats ?? null;
    const seatsUsed = calendar._count.members;

    return {
      calendar: {
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        theme: calendar.theme,
        isPremium: calendar.isPremium,
        publicIcsEnabled: calendar.publicIcsEnabled,
        role: membership.role,
      },

      members: {
        total: calendar._count.members,
        premiumSeats:
          seatsTotal !== null
            ? {
                total: seatsTotal,
                used: seatsUsed,
                remaining: Math.max(0, seatsTotal - seatsUsed),
              }
            : null,
      },

      upcomingEvents,

      activity: {
        last7d,
        last30d,
      },

      integrations: {
        google: {
          enabled: calendar.syncMode !== 'NONE',
          syncMode: calendar.syncMode,
        },
      },

      permissions: {
        canEdit: ['owner', 'admin', 'editor'].includes(membership.role),
        canInvite: ['owner', 'admin'].includes(membership.role),
        canManagePremium: membership.role === 'owner',
      },
    };
  }
  private async assertIsAdminOrOwner(userId: string, calendarId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      select: { role: true },
    });

    if (!membership) throw new ForbiddenException('No access');
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async enablePublicIcs(userId: string, calendarId: string) {
    await this.assertIsAdminOrOwner(userId, calendarId);

    const cal = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { id: true, publicIcsEnabled: true, publicIcsToken: true },
    });
    if (!cal) throw new NotFoundException('Calendar not found');

    const token = cal.publicIcsToken ?? randomUUID();

    const updated = await this.prisma.calendar.update({
      where: { id: calendarId },
      data: { publicIcsEnabled: true, publicIcsToken: token },
      select: { publicIcsEnabled: true, publicIcsToken: true },
    });

    return updated;
  }

  async rotatePublicIcs(userId: string, calendarId: string) {
    await this.assertIsAdminOrOwner(userId, calendarId);

    const updated = await this.prisma.calendar.update({
      where: { id: calendarId },
      data: { publicIcsEnabled: true, publicIcsToken: randomUUID() },
      select: { publicIcsEnabled: true, publicIcsToken: true },
    });

    return updated;
  }

  async disablePublicIcs(userId: string, calendarId: string) {
    await this.assertIsAdminOrOwner(userId, calendarId);

    const updated = await this.prisma.calendar.update({
      where: { id: calendarId },
      data: { publicIcsEnabled: false, publicIcsToken: null },
      select: { publicIcsEnabled: true, publicIcsToken: true },
    });

    return updated;
  }
}
