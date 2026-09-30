import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { MemberRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CalendarHomeDto } from './dto/calendar-home.dto';
import { FREE_THEMES, PREMIUM_THEMES } from './theme.constants';
import { FilesService } from '../files/files.service';

// Assez pour un usage basique (un calendrier partagé + un deuxième), assez
// serré pour que quiconque est vraiment engagé sur l'app ressente le mur.
const FREE_MAX_CALENDARS = 2;

@Injectable()
export class CalendarsService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  async create(userId: string, dto: CreateCalendarDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const isPremium = user.isPremium;

    // 1) Freemium: max FREE_MAX_CALENDARS calendriers.
    // Contrôle uniquement à la création — un calendrier déjà créé (ex:
    // pendant une période premium) reste pleinement utilisable même après
    // une perte de premium ; seule la création de nouveaux calendriers
    // au-delà de la limite est bloquée (jamais de suppression forcée).
    if (!isPremium) {
      const count = await this.prisma.calendar.count({
        where: { ownerId: userId },
      });
      if (count >= FREE_MAX_CALENDARS) {
        throw new ForbiddenException(
          `Freemium users can only create up to ${FREE_MAX_CALENDARS} calendars`,
        );
      }
    }

    // 2) Themes premium
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
        theme: true,
        calendar: {
          select: {
            id: true,
            name: true,
            color: true,
            theme: true,
            coverImageUrl: true,
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

    const calendarIds = memberships.map((m) => m.calendar.id);
    // Comptée à part : _count.select ne permet qu'un seul compte par relation,
    // or on veut à la fois le total (ci-dessus) et le nombre à venir.
    const upcomingCounts = calendarIds.length
      ? await this.prisma.event.groupBy({
          by: ['calendarId'],
          where: {
            calendarId: { in: calendarIds },
            startDateTime: { gte: new Date() },
          },
          _count: { _all: true },
        })
      : [];
    const upcomingByCalendarId = new Map(
      upcomingCounts.map((c) => [c.calendarId, c._count._all]),
    );

    return memberships.map((m) => ({
      id: m.calendar.id,
      name: m.calendar.name,
      color: m.calendar.color,
      theme: m.theme ?? m.calendar.theme ?? 'default',
      coverImageUrl: m.calendar.coverImageUrl,
      isPremium: m.calendar.isPremium,
      publicIcsEnabled: m.calendar.publicIcsEnabled,
      role: m.role,
      membersCount: m.calendar._count.members,
      eventsCount: m.calendar._count.events,
      upcomingEventsCount: upcomingByCalendarId.get(m.calendar.id) ?? 0,
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
      select: { role: true, theme: true },
    });
    if (!membership) throw new ForbiddenException('No access to this calendar');

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: {
        id: true,
        name: true,
        color: true,
        theme: true,
        coverImageUrl: true,
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
        comments: f.filter((l) => l.action === 'COMMENT_CREATE').length,
        files: f.filter((l) => l.action === 'FILE_UPLOAD').length,
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
        theme: membership.theme ?? calendar.theme ?? 'default',
        coverImageUrl: calendar.coverImageUrl,
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

  async update(userId: string, calendarId: string, dto: UpdateCalendarDto) {
    await this.assertIsAdminOrOwner(userId, calendarId);

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { isPremium: true, coverImageUrl: true },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');

    if (dto.theme !== undefined) {
      const isPremiumTheme = PREMIUM_THEMES.includes(dto.theme);
      if (isPremiumTheme && !calendar.isPremium) {
        throw new ForbiddenException('This theme requires a premium calendar');
      }
      if (!isPremiumTheme && !FREE_THEMES.includes(dto.theme)) {
        throw new ForbiddenException('Unknown theme');
      }
    }

    if (dto.coverImageUrl !== undefined && !calendar.isPremium) {
      throw new ForbiddenException('Cover images require a premium calendar');
    }

    const previousCoverImageUrl = calendar.coverImageUrl;

    const updated = await this.prisma.calendar.update({
      where: { id: calendarId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...(dto.coverImageUrl !== undefined
          ? { coverImageUrl: dto.coverImageUrl }
          : {}),
      },
    });

    // Nettoyage de l'ancienne image de couverture si elle a été remplacée
    // ou retirée : sinon elle reste orpheline sur le disque pour toujours
    // (fuite de stockage, et ça grignote le quota premium de l'uploadeur
    // original sans raison).
    if (
      dto.coverImageUrl !== undefined &&
      previousCoverImageUrl &&
      previousCoverImageUrl !== dto.coverImageUrl &&
      previousCoverImageUrl.startsWith('/files/')
    ) {
      const oldFileId = previousCoverImageUrl.slice('/files/'.length);
      await this.filesService.deleteFileInternal(oldFileId, userId);
    }

    return updated;
  }

  // Thème personnel : chaque membre choisit sa propre couleur d'affichage
  // pour ce calendrier, indépendamment des autres membres.
  async setMyTheme(userId: string, calendarId: string, theme: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      include: { user: { select: { isPremium: true } } },
    });
    if (!membership) throw new ForbiddenException('No access to this calendar');

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { isPremium: true },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');

    const hasPremium = membership.user.isPremium || calendar.isPremium;
    const isPremiumTheme = PREMIUM_THEMES.includes(theme);
    if (isPremiumTheme && !hasPremium) {
      throw new ForbiddenException(
        'This theme requires a premium calendar or account',
      );
    }
    if (!isPremiumTheme && !FREE_THEMES.includes(theme)) {
      throw new ForbiddenException('Unknown theme');
    }

    await this.prisma.calendarMember.update({
      where: { calendarId_userId: { calendarId, userId } },
      data: { theme },
    });

    return { theme };
  }

  async remove(userId: string, calendarId: string) {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { ownerId: true },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');

    if (calendar.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this calendar');
    }

    const events = await this.prisma.event.findMany({
      where: { calendarId },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);

    // Chemins disque à nettoyer une fois les lignes supprimées en base
    // (deleteMany ne touche pas au disque).
    const filesToUnlink = await this.prisma.file.findMany({
      where: { OR: [{ calendarId }, { eventId: { in: eventIds } }] },
      select: { storagePath: true },
    });

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { eventId: { in: eventIds } },
      }),
      this.prisma.file.deleteMany({
        where: {
          OR: [{ calendarId }, { eventId: { in: eventIds } }],
        },
      }),
      this.prisma.event.deleteMany({ where: { calendarId } }),
      this.prisma.invitationLink.deleteMany({ where: { calendarId } }),
      this.prisma.calendarMember.deleteMany({ where: { calendarId } }),
      this.prisma.groupPlan.updateMany({
        where: { calendarId },
        data: { calendarId: null },
      }),
      this.prisma.calendar.delete({ where: { id: calendarId } }),
    ]);

    for (const f of filesToUnlink) {
      try {
        if (fs.existsSync(f.storagePath)) fs.unlinkSync(f.storagePath);
      } catch (err) {
        console.error('[remove calendar] file cleanup failed', f.storagePath, err);
      }
    }

    return { deleted: true, id: calendarId };
  }

  async listMembers(userId: string, calendarId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('No access to this calendar');
    }

    const members = await this.prisma.calendarMember.findMany({
      where: { calendarId },
      orderBy: { joinedAt: 'asc' },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isPremium: true,
          },
        },
      },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  async updateMemberRole(
    actorUserId: string,
    calendarId: string,
    targetUserId: string,
    newRole: MemberRole,
  ) {
    const actor = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId: actorUserId },
      select: { role: true },
    });
    if (!actor) throw new ForbiddenException('No access to this calendar');
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const target = await this.prisma.calendarMember.findUnique({
      where: { calendarId_userId: { calendarId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found');

    // Only owner can promote to owner (ownership transfer).
    if (newRole === 'owner' && actor.role !== 'owner') {
      throw new ForbiddenException('Only the owner can transfer ownership');
    }

    // Only owner can change another owner.
    if (target.role === 'owner' && actor.role !== 'owner') {
      throw new ForbiddenException('Only the owner can modify the owner');
    }

    // Prevent demoting the last owner.
    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await this.prisma.calendarMember.count({
        where: { calendarId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last owner — transfer ownership first',
        );
      }
    }

    // Ownership transfer: also flip Calendar.ownerId in a transaction.
    if (newRole === 'owner' && target.role !== 'owner') {
      await this.prisma.$transaction([
        this.prisma.calendarMember.update({
          where: { calendarId_userId: { calendarId, userId: targetUserId } },
          data: { role: 'owner' },
        }),
        this.prisma.calendar.update({
          where: { id: calendarId },
          data: { ownerId: targetUserId },
        }),
      ]);
      return { id: targetUserId, role: 'owner' as MemberRole };
    }

    const updated = await this.prisma.calendarMember.update({
      where: { calendarId_userId: { calendarId, userId: targetUserId } },
      data: { role: newRole },
      select: { role: true },
    });

    return { id: targetUserId, role: updated.role };
  }

  async removeMember(
    actorUserId: string,
    calendarId: string,
    targetUserId: string,
  ) {
    const actor = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId: actorUserId },
      select: { role: true },
    });
    if (!actor) throw new ForbiddenException('No access to this calendar');

    const target = await this.prisma.calendarMember.findUnique({
      where: { calendarId_userId: { calendarId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found');

    const isSelf = actorUserId === targetUserId;

    // Permissions:
    //  - self can always leave (subject to the last-owner rule below)
    //  - owner/admin can remove others
    //  - only owner can remove an owner
    if (!isSelf) {
      if (actor.role !== 'owner' && actor.role !== 'admin') {
        throw new ForbiddenException('Insufficient permissions');
      }
      if (target.role === 'owner' && actor.role !== 'owner') {
        throw new ForbiddenException('Only the owner can remove the owner');
      }
    }

    // Prevent removing the last owner.
    if (target.role === 'owner') {
      const ownerCount = await this.prisma.calendarMember.count({
        where: { calendarId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last owner — transfer ownership first',
        );
      }
    }

    await this.prisma.calendarMember.delete({
      where: { calendarId_userId: { calendarId, userId: targetUserId } },
    });

    return { removed: true, userId: targetUserId };
  }
}
