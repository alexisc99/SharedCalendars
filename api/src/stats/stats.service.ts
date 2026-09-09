import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DashboardStatsDto,
  DashboardCalendarDto,
} from './dto/dashboard-stats.dto';

const GRACE_PERIOD_DAYS = 7;

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getCalendarStats(calendarId: string) {
    const now = new Date();

    const last7Days = new Date();
    last7Days.setDate(now.getDate() - 7);

    const last30Days = new Date();
    last30Days.setDate(now.getDate() - 30);

    // ─────────────────────────────
    // TOTAL COUNTS (via AuditLog)
    // ─────────────────────────────

    const [eventsCreated, eventsPublished, commentsCreated, filesUploaded] =
      await Promise.all([
        this.countAction(calendarId, 'EVENT_CREATE'),
        this.countAction(calendarId, 'EVENT_PUBLISH'),
        this.countAction(calendarId, 'COMMENT_CREATE'),
        this.countAction(calendarId, 'FILE_UPLOAD'),
      ]);

    // ─────────────────────────────
    // ACTIVITY WINDOW
    // ─────────────────────────────

    const activityLast7Days = await this.countActionsSince(
      calendarId,
      last7Days,
    );

    const activityLast30Days = await this.countActionsSince(
      calendarId,
      last30Days,
    );

    // ─────────────────────────────
    // TOP CONTRIBUTORS
    // ─────────────────────────────

    const topContributors = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        metadata: {
          path: ['calendarId'],
          equals: calendarId,
        },
      },
      _count: {
        userId: true,
      },
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 5,
    });

    const contributorUsers = await this.prisma.user.findMany({
      where: { id: { in: topContributors.map((c) => c.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const contributorById = new Map(contributorUsers.map((u) => [u.id, u]));

    return {
      totals: {
        eventsCreated,
        eventsPublished,
        commentsCreated,
        filesUploaded,
      },
      activity: {
        last7Days: activityLast7Days,
        last30Days: activityLast30Days,
      },
      topContributors: topContributors.map((c) => ({
        userId: c.userId,
        name: contributorById.get(c.userId)?.name ?? null,
        avatarUrl: contributorById.get(c.userId)?.avatarUrl ?? null,
        actions: c._count.userId,
      })),
    };
  }

  ///
  //Stats de calendriers premiums
  ///
  async getPremiumGroupCalendarStats(calendarId: string) {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      include: {
        members: true,
        groupPlan: true,
      },
    });

    if (!calendar) throw new NotFoundException('Calendar not found');
    if (!calendar.groupPlan) {
      throw new ForbiddenException(
        'This calendar is not linked to a group plan',
      );
    }

    const now = new Date();
    const expiresAt = calendar.groupPlan.expiresAt;

    const daysToExpiration = expiresAt
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const graceLimit = expiresAt
      ? new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
      : null;

    const isInGracePeriod = expiresAt
      ? now > expiresAt && graceLimit !== null && now <= graceLimit
      : false;

    const last7Days = new Date();
    last7Days.setDate(now.getDate() - 7);

    const last30Days = new Date();
    last30Days.setDate(now.getDate() - 30);

    const [activityLast7Days, activityLast30Days] = await Promise.all([
      this.countActionsSince(calendarId, last7Days),
      this.countActionsSince(calendarId, last30Days),
    ]);

    const topContributors = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        metadata: {
          path: ['calendarId'],
          equals: calendarId,
        },
      },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });

    const seatsUsed = calendar.members.length;
    const seatsTotal = calendar.premiumSeats ?? null;
    const seatsRemaining =
      seatsTotal !== null ? Math.max(seatsTotal - seatsUsed, 0) : null;

    return {
      calendarId: calendar.id,
      groupPlanId: calendar.groupPlan.id,
      plan: {
        isActive: calendar.groupPlan.isActive,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        daysToExpiration,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        isInGracePeriod,
      },
      seats: {
        total: seatsTotal,
        used: seatsUsed,
        remaining: seatsRemaining,
      },
      activity: {
        last7Days: activityLast7Days,
        last30Days: activityLast30Days,
        topContributors: topContributors.map((c) => ({
          userId: c.userId,
          actions: c._count.userId,
        })),
      },
    };
  }
  // ─────────────────────────────
  // HELPERS
  // ─────────────────────────────

  private async countAction(calendarId: string, action: string) {
    return this.prisma.auditLog.count({
      where: {
        action,
        metadata: {
          path: ['calendarId'],
          equals: calendarId,
        },
      },
    });
  }

  private async countActionsSince(calendarId: string, since: Date) {
    return this.prisma.auditLog.count({
      where: {
        metadata: {
          path: ['calendarId'],
          equals: calendarId,
        },
        createdAt: {
          gte: since,
        },
      },
    });
  }
  private async countAuditActionsSince(calendarId: string, since: Date) {
    // On suppose que vos AuditLog metadata contient calendarId (ou entityId).
    // Pour rester compatible: on compte par action + metadata.calendarId si présent,
    // sinon par entity='Calendar' + entityId=calendarId (selon votre convention).
    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { metadata: { path: ['calendarId'], equals: calendarId } as any },
          { entity: 'Calendar', entityId: calendarId },
        ],
      },
      select: { action: true },
    });

    let eventsCreated = 0;
    let eventsPublished = 0;
    let comments = 0;
    let files = 0;

    for (const l of logs) {
      if (l.action === 'EVENT_CREATE') eventsCreated += 1;
      if (l.action === 'EVENT_PUBLISH') eventsPublished += 1;
      if (l.action === 'COMMENT_CREATE') comments += 1;
      if (l.action === 'FILE_UPLOAD') files += 1;
    }

    return { eventsCreated, eventsPublished, comments, files };
  }

  async getDashboard(userId: string) {
    // 1) Unread notifications
    const unreadNotifications = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    // 2) My calendars summary (role + counts)
    const memberships = await this.prisma.calendarMember.findMany({
      where: { userId },
      select: {
        role: true,
        theme: true,
        calendar: {
          select: {
            id: true,
            name: true,
            theme: true,
            coverImageUrl: true,
            isPremium: true,
            publicIcsEnabled: true,
            createdAt: true,
            _count: { select: { members: true, events: true } },
          },
        },
      },
      orderBy: { calendar: { createdAt: 'desc' } },
    });

    const calendarIds = memberships.map((m) => m.calendar.id);

    const calendarInfoById = new Map(
      memberships.map((m) => [
        m.calendar.id,
        {
          name: m.calendar.name,
          theme: m.theme ?? m.calendar.theme ?? 'default',
        },
      ]),
    );

    // 3) Upcoming events across all accessible calendars (PUBLISHED only)
    const upcomingEventsRaw = await this.prisma.event.findMany({
      where: {
        calendarId: { in: calendarIds },
        status: 'PUBLISHED',
        startDateTime: { gte: new Date() },
      },
      orderBy: { startDateTime: 'asc' },
      take: 10,
      select: {
        id: true,
        calendarId: true,
        title: true,
        startDateTime: true,
        endDateTime: true,
      },
    });

    const upcomingEvents = upcomingEventsRaw.map((e) => ({
      ...e,
      calendarName: calendarInfoById.get(e.calendarId)?.name ?? '',
      theme: calendarInfoById.get(e.calendarId)?.theme ?? 'default',
    }));

    // 4) Activity stats 7d / 30d per calendar (simple loop; optimize later if needed)
    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const calendars: DashboardCalendarDto[] = [];
    for (const m of memberships) {
      const [last7d, last30d] = await Promise.all([
        this.countAuditActionsSince(m.calendar.id, since7),
        this.countAuditActionsSince(m.calendar.id, since30),
      ]);

      calendars.push({
        id: m.calendar.id,
        name: m.calendar.name,
        theme: m.theme ?? m.calendar.theme ?? 'default',
        coverImageUrl: m.calendar.coverImageUrl,
        role: m.role,
        isPremium: m.calendar.isPremium,
        publicIcsEnabled: m.calendar.publicIcsEnabled,
        membersCount: m.calendar._count.members,
        eventsCount: m.calendar._count.events,
        activity: { last7d, last30d },
      });
    }

    return {
      unreadNotifications,
      upcomingEvents,
      calendars,
    };
  }
}
