import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CalendarEventsQueryDto } from './dto/calendar-events-query.dto';
import { Event, EventStatus, EventType, MemberRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EventDetailQueryDto } from './dto/event-detail-query.dto';
import { decodeEventsCursor, encodeEventsCursor } from './utils/events-cursor';
import { buildGoogleMapsSearchUrl } from 'src/common/maps/maps-links';

//import { PollOptionType } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditService: AuditService,
  ) {}

  // ---------- CREATE ----------
  async createEvent(userId: string, calendarId: string, dto: CreateEventDto) {
    const role = await this.getUserRoleInCalendar(userId, calendarId);
    const membership = await this.getMembership(userId, calendarId);
    if (!role)
      throw new ForbiddenException('You are not a member of this calendar');
    // 1) VIEWER → ne peut rien créer
    if (role === 'viewer') {
      throw new ForbiddenException('Viewers cannot create events');
    }
    // 2) Vérifier premium pour les fonctionnalités premium
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { isPremium: true },
    });

    const hasPremium =
      membership.user.isPremium || calendar?.isPremium === true;
    // Pour pouvoir créer un sondage
    if (dto.type === EventType.POLL && !hasPremium) {
      throw new ForbiddenException('Polls require premium');
    }

    // Pour créer des rappels multiples → premium uniquement
    if (dto.reminders && dto.reminders.length > 1 && !hasPremium) {
      throw new ForbiddenException(
        'Multiple reminders require a premium account',
      );
    }
    // Pour créer des fonctionnalités premium futures
    // (lieux premium, thèmes premium, fichiers joints…)
    if (dto.pollType && !hasPremium) {
      throw new ForbiddenException(
        'Premium required for advanced poll features',
      );
    }

    // Permissions créateur
    let status: EventStatus;

    if (role === 'owner' || role === 'admin') {
      status = EventStatus.PUBLISHED;
    } else if (role === 'editor') {
      status = EventStatus.PENDING;
    } else {
      throw new ForbiddenException('You cannot create an event');
    }

    const event = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          calendarId,
          creatorId: userId,
          title: dto.title,
          description: dto.description,
          location: dto.location,
          locationAddress: dto.locationAddress ?? null,
          startDateTime: new Date(dto.startDateTime),
          endDateTime: new Date(dto.endDateTime),
          type: dto.type ?? EventType.STANDARD,
          recurrenceRule: dto.recurrenceRule,
          status,
        },
      });

      // Gérer pollOptions si type = POLL
      if (dto.type === EventType.POLL) {
        if (!dto.pollType) {
          throw new BadRequestException(
            'pollType is required when type = POLL',
          );
        }

        if (!dto.pollOptions || dto.pollOptions.length < 2) {
          throw new BadRequestException(
            'pollOptions must contain at least 2 items',
          );
        }

        if (dto.pollOptions.length > 10) {
          throw new BadRequestException('pollOptions cannot exceed 10 items');
        }

        for (const option of dto.pollOptions) {
          await tx.pollOption.create({
            data: {
              label: option.label,
              eventId: event.id,
              optionType: dto.pollType, // 🎯 DYNAMIQUE
            },
          });
        }
      }

      // Rappels : la validation (max 1 en gratuit) se fait plus haut, mais
      // rien ne créait jamais les lignes EventReminder correspondantes.
      if (dto.reminders && dto.reminders.length > 0) {
        await tx.eventReminder.createMany({
          data: dto.reminders.map((r) => ({
            eventId: event.id,
            minutesBefore: r.minutesBefore,
          })),
        });
      }

      // NOTIFICATION
      const members = await tx.calendarMember.findMany({
        where: { calendarId },
      });

      if (status === EventStatus.PENDING) {
        // notifier admins et owner
        const adminIds = members
          .filter(
            (m) => m.role === MemberRole.owner || m.role === MemberRole.admin,
          )
          .map((m) => m.userId);

        await this.notifications.notifyUsers(tx, adminIds, {
          type: 'EVENT_PENDING',
          title: `Événement en attente : ${dto.title}`,
          eventId: event.id,
        });
      } else {
        // notifier tous sauf créateur
        const targets = members
          .filter((m) => m.userId !== userId)
          .map((m) => m.userId);

        await this.notifications.notifyUsers(tx, targets, {
          type: 'EVENT_PUBLISHED',
          title: `Nouvel événement : ${dto.title}`,
          eventId: event.id,
        });
      }

      return event;
    });

    this.auditService.log({
      userId,
      action: 'EVENT_CREATE',
      entity: 'Event',
      entityId: event.id,
      metadata: {
        calendarId: event.calendarId,
      },
    });

    return event;
  }

  private async getUserRoleInCalendar(userId: string, calendarId: string) {
    const membership = await this.prisma.calendarMember.findUnique({
      where: {
        calendarId_userId: { calendarId, userId },
      },
      include: { user: true },
    });
    return membership?.role ?? null;
  }

  async publishEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const role = await this.getUserRoleInCalendar(userId, event.calendarId);
    if (
      role === null ||
      (role !== MemberRole.owner && role !== MemberRole.admin)
    ) {
      throw new ForbiddenException('You cannot publish this event');
    }
    if (event.status !== 'PENDING') {
      throw new ForbiddenException(
        'You cannot publish an already published event',
      );
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PUBLISHED },
    });
    this.auditService.log({
      userId,
      action: 'EVENT_PUBLISH',
      entity: 'Event',
      entityId: updated.id,
      metadata: {
        calendarId: updated.calendarId,
      },
    });

    // notify members
    const members = await this.prisma.calendarMember.findMany({
      where: { calendarId: event.calendarId },
    });

    const targetIds = members
      .filter((m) => m.userId !== event.creatorId)
      .map((m) => m.userId);

    await this.notifications.notifyUsers(targetIds, {
      type: 'EVENT_PUBLISHED',
      title: `Événement publié : ${event.title}`,
      eventId,
    });

    return updated;
  }

  async rejectEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const role = await this.getUserRoleInCalendar(userId, event.calendarId);
    if (
      role === null ||
      (role !== MemberRole.owner && role !== MemberRole.admin)
    ) {
      throw new ForbiddenException('You cannot reject this event');
    }

    await this.prisma.event.delete({
      where: { id: eventId },
    });

    await this.notifications.notifyUsers([event.creatorId], {
      type: 'EVENT_REJECTED',
      title: `Votre événement "${event.title}" a été rejeté`,
    });

    return { success: true };
  }

  //GET USER FEED

  async getUserFeed(userId: string, query: CalendarEventsQueryDto) {
    const memberships = await this.prisma.calendarMember.findMany({
      where: { userId },
      select: {
        calendarId: true,
        theme: true,
        calendar: { select: { id: true, name: true, color: true, theme: true } },
      },
    });

    if (memberships.length === 0) {
      return { items: [], nextCursor: null };
    }

    if (query.from && query.to) {
      const a = new Date(query.from).getTime();
      const b = new Date(query.to).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) {
        throw new BadRequestException('"from" must be <= "to"');
      }
    }

    const calendarIds = memberships.map((m) => m.calendarId);
    const calendarMap = new Map(
      memberships.map((m) => [
        m.calendarId,
        {
          ...m.calendar,
          // Thème personnel de l'utilisateur pour ce calendrier, sinon thème par défaut.
          theme: m.theme ?? m.calendar.theme ?? 'default',
        },
      ]),
    );

    const limit = query.limit ?? 50;

    const and: any[] = [];
    and.push({ calendarId: { in: calendarIds } });

    if (query.status) {
      and.push({ status: query.status });
    }

    if (query.from || query.to) {
      const range: any = {};
      if (query.from) range.gte = new Date(query.from);
      if (query.to) range.lte = new Date(query.to);
      and.push({ startDateTime: range });
    }

    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.cursor) {
      let c: { startDateTime: string; id: string };
      try {
        c = decodeEventsCursor(query.cursor);
      } catch {
        throw new BadRequestException('Invalid cursor');
      }

      const cursorDate = new Date(c.startDateTime);
      if (Number.isNaN(cursorDate.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }

      and.push({
        OR: [
          { startDateTime: { gt: cursorDate } },
          {
            AND: [
              { startDateTime: { equals: cursorDate } },
              { id: { gt: c.id } },
            ],
          },
        ],
      });
    }

    const where = { AND: and };

    const events = await this.prisma.event.findMany({
      where,
      orderBy: [{ startDateTime: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        calendarId: true,
        title: true,
        startDateTime: true,
        endDateTime: true,
        status: true,
        source: true,
        googleEventId: true,
        rsvps: { where: { userId }, select: { status: true } },
      },
    });

    const hasNext = events.length > limit;
    const page = hasNext ? events.slice(0, limit) : events;

    const items = page.map((e) => ({
      id: e.id,
      calendar: calendarMap.get(e.calendarId)!,
      title: e.title,
      startDateTime: e.startDateTime,
      endDateTime: e.endDateTime,
      status: e.status,
      rsvp: e.rsvps[0]?.status ?? null,
      google: {
        synced: !!e.googleEventId,
        imported: e.source === 'GOOGLE',
      },
    }));

    const nextCursor = hasNext
      ? encodeEventsCursor({
          startDateTime: page[page.length - 1].startDateTime.toISOString(),
          id: page[page.length - 1].id,
        })
      : null;

    return { items, nextCursor };
  }

  // ---------- LIST BY CALENDAR ----------

  ///HELPERS
  private parseCursor(
    cursor?: string,
  ): { startDateTime: Date; id: string } | null {
    if (!cursor) return null;
    const parts = cursor.split('|');
    if (parts.length !== 2)
      throw new BadRequestException('Invalid cursor format');
    const [iso, id] = parts;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime()) || !id)
      throw new BadRequestException('Invalid cursor format');
    return { startDateTime: dt, id };
  }

  private makeCursor(e: { startDateTime: Date; id: string }) {
    return `${e.startDateTime.toISOString()}|${e.id}`;
  }
  async listEventsForCalendarPaged(
    userId: string,
    calendarId: string,
    query: CalendarEventsQueryDto,
  ) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('No access to this calendar');

    if (query.from && query.to) {
      const a = new Date(query.from).getTime();
      const b = new Date(query.to).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) {
        throw new BadRequestException('"from" must be <= "to"');
      }
    }

    const limit = query.limit ?? 50;

    const and: any[] = [];
    and.push({ calendarId });

    if (query.status) {
      and.push({ status: query.status });
    }

    if (query.from || query.to) {
      const range: any = {};
      if (query.from) range.gte = new Date(query.from);
      if (query.to) range.lte = new Date(query.to);
      and.push({ startDateTime: range });
    }

    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.cursor) {
      let c: { startDateTime: string; id: string };
      try {
        c = decodeEventsCursor(query.cursor);
      } catch {
        throw new BadRequestException('Invalid cursor');
      }

      const cursorDate = new Date(c.startDateTime);
      if (Number.isNaN(cursorDate.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }

      and.push({
        OR: [
          { startDateTime: { gt: cursorDate } },
          {
            AND: [
              { startDateTime: { equals: cursorDate } },
              { id: { gt: c.id } },
            ],
          },
        ],
      });
    }

    const where = { AND: and };

    const events = await this.prisma.event.findMany({
      where,
      orderBy: [{ startDateTime: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        calendarId: true,
        title: true,
        description: true,
        location: true,
        locationAddress: true,
        startDateTime: true,
        endDateTime: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        googleEventId: true,
        googleCalendarId: true,
        source: true,
        creator: { select: { id: true, name: true } },
        _count: { select: { comments: true, files: true } },
        rsvps: { where: { userId }, select: { status: true } },
      },
    });

    const hasNext = events.length > limit;
    const page = hasNext ? events.slice(0, limit) : events;

    const items = page.map((e) => ({
      id: e.id,
      calendarId: e.calendarId,
      title: e.title,
      description: e.description,
      location: e.location,
      startDateTime: e.startDateTime,
      endDateTime: e.endDateTime,
      type: e.type,
      status: e.status,
      createdBy: e.creator,
      rsvp: e.rsvps[0]?.status ?? null,
      commentsCount: e._count.comments,
      filesCount: e._count.files,
      google: {
        synced: !!e.googleEventId,
        imported: e.source === 'GOOGLE',
        calendarId: e.googleCalendarId ?? null,
      },
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    const nextCursor = hasNext
      ? encodeEventsCursor({
          startDateTime: page[page.length - 1].startDateTime.toISOString(),
          id: page[page.length - 1].id,
        })
      : null;

    return { items, nextCursor };
  }

  // ---------- GET BY ID ----------
  async getEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        reminders: true,
        pollOptions: true,
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    await this.getMembership(userId, event.calendarId);

    return event;
  }
  async getEventDetail(
    userId: string,
    eventId: string,
    query?: EventDetailQueryDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        calendar: { select: { id: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        reminders: {
          select: { id: true, minutesBefore: true },
          orderBy: { minutesBefore: 'asc' },
        },
        rsvps: {
          select: {
            userId: true,
            status: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        pollOptions: {
          select: {
            id: true,
            label: true,
            optionType: true,
            votes: { select: { userId: true } },
          },
          orderBy: { label: 'asc' },
        },
        _count: {
          select: {
            comments: true,
            files: true,
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    // Permission inline: membership must exist on event.calendarId
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: event.calendarId },
      select: { role: true },
    });
    if (!membership)
      throw new ForbiddenException('You do not have access to this calendar');
    //comments and files paginés

    const address = event.locationAddress?.trim() ?? '';
    const googleMapsUrl = address ? buildGoogleMapsSearchUrl(address) : null;

    const commentsLimit = query?.commentsLimit ?? 20;

    const comments = await this.prisma.comment.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: commentsLimit + 1,
      ...(query?.commentsCursor
        ? { skip: 1, cursor: { id: query.commentsCursor } }
        : {}),
      select: { id: true, userId: true, text: true, createdAt: true },
    });

    const commentsHasNext = comments.length > commentsLimit;
    const commentsPage = commentsHasNext
      ? comments.slice(0, commentsLimit)
      : comments;

    const commentsNextCursor = commentsHasNext
      ? commentsPage[commentsPage.length - 1].id
      : null;

    const filesLimit = query?.filesLimit ?? 50;

    const files = await this.prisma.file.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: filesLimit + 1,
      ...(query?.filesCursor
        ? { skip: 1, cursor: { id: query.filesCursor } }
        : {}),
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        uploadedById: true,
        createdAt: true,
      },
    });

    const filesHasNext = files.length > filesLimit;
    const filesPage = filesHasNext ? files.slice(0, filesLimit) : files;

    const filesNextCursor = filesHasNext
      ? filesPage[filesPage.length - 1].id
      : null;

    // RSVP stats
    const counts = { YES: 0, MAYBE: 0, NO: 0 } as any;
    let mine: any = null;

    for (const r of event.rsvps) {
      counts[r.status] += 1;
      if (r.userId === userId) mine = r.status;
    }

    // Détail "qui a répondu quoi" — pour savoir si une personne précise vient.
    const voters = event.rsvps.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      avatarUrl: r.user.avatarUrl,
      status: r.status,
    }));

    // Poll shaping
    const poll =
      event.type === 'POLL'
        ? {
            finalizedOptionId: event.finalizedOptionId ?? null,
            finalizedEventId: event.finalizedEventId ?? null,
            options: event.pollOptions.map((o) => ({
              id: o.id,
              label: o.label,
              optionType: o.optionType,
              votesCount: o.votes.length,
              votedByMe: o.votes.some((v) => v.userId === userId),
            })),
          }
        : null;

    return {
      id: event.id,
      calendarId: event.calendarId,

      title: event.title,
      description: event.description,
      location: event.location,
      locationAddress: event.locationAddress,
      maps: { googleMapsUrl },

      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,

      type: event.type,
      status: event.status,

      createdBy: event.creator,

      reminders: event.reminders,

      rsvp: { mine, counts, voters },

      comments: {
        total: event._count.comments,
        items: commentsPage,
        nextCursor: commentsNextCursor,
      },

      files: {
        total: event._count.files,
        items: filesPage,
        nextCursor: filesNextCursor,
      },

      poll,

      google: {
        synced: !!event.googleEventId,
        imported: event.source === 'GOOGLE',
        calendarId: event.googleCalendarId ?? null,
        eventId: event.googleEventId ?? null,
      },

      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  // ---------- UPDATE ----------
  async updateEvent(userId: string, eventId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const membership = await this.getMembership(userId, event.calendarId);
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: event.calendarId },
      select: { isPremium: true },
    });

    const hasPremium =
      membership.user.isPremium || calendar?.isPremium === true;

    // VIEWER → aucun droit
    if (membership.role === 'viewer') {
      throw new ForbiddenException('Viewers cannot update events');
    }
    // Restrictions premium :
    if (dto.type === EventType.POLL && !hasPremium) {
      throw new ForbiddenException('Premium required to edit polls');
    }

    if (dto.reminders && dto.reminders.length > 1 && !hasPremium) {
      throw new ForbiddenException(
        'Multiple reminders require a premium account',
      );
    }
    this.ensureModifyPermission(membership.role, userId, event);

    const isPast = event.endDateTime.getTime() < Date.now();
    const triesToChangeScheduleOrLocation =
      dto.startDateTime !== undefined ||
      dto.endDateTime !== undefined ||
      dto.location !== undefined ||
      dto.locationAddress !== undefined;

    if (isPast && triesToChangeScheduleOrLocation) {
      throw new BadRequestException(
        'Cannot change the time or location of a past event',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          title: dto.title ?? event.title,
          description: dto.description ?? event.description,
          location: dto.location ?? event.location,
          locationAddress: dto.locationAddress ?? null,
          startDateTime: dto.startDateTime
            ? new Date(dto.startDateTime)
            : event.startDateTime,
          endDateTime: dto.endDateTime
            ? new Date(dto.endDateTime)
            : event.endDateTime,
          type: dto.type ?? event.type,
          recurrenceRule: dto.recurrenceRule ?? event.recurrenceRule,
        },
      });

      // Rappels : comme à la création, dto.reminders n'était jamais
      // persisté. Quand le champ est fourni, il remplace intégralement la
      // liste existante (même logique qu'un formulaire "reminders: [...]").
      if (dto.reminders !== undefined) {
        await tx.eventReminder.deleteMany({ where: { eventId } });
        if (dto.reminders.length > 0) {
          await tx.eventReminder.createMany({
            data: dto.reminders.map((r) => ({
              eventId,
              minutesBefore: r.minutesBefore,
            })),
          });
        }
      }

      return updated;
    });
  }

  // ---------- DELETE ----------
  async deleteEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const membership = await this.getMembership(userId, event.calendarId);
    // viewer → interdit
    if (membership.role === 'viewer') {
      throw new ForbiddenException('Viewers cannot delete events');
    }
    // editor → NE PEUT PAS supprimer
    if (membership.role === 'editor') {
      throw new ForbiddenException('Editors cannot delete events');
    }
    this.ensureModifyPermission(membership.role, userId, event);

    await this.prisma.event.delete({ where: { id: eventId } });
    return { success: true };
  }

  // ---------- PERMISSIONS & HELPERS ----------

  private async getMembership(userId: string, calendarId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      include: { user: true },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');
    return membership;
  }

  // role: 'owner','admin','editor','viewer','member'
  private ensureCreatePermission(role: string) {
    if (['owner', 'admin', 'editor', 'member'].includes(role)) return;
    throw new ForbiddenException('You cannot create events');
  }

  private ensureModifyPermission(role: string, userId: string, event: Event) {
    if (['owner', 'admin', 'editor'].includes(role)) return;
    if (role === 'member' && event.creatorId === userId) return;
    throw new ForbiddenException('You cannot modify this event');
  }
}
