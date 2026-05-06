import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsListQueryDto } from './dto/notifications-list-query.dto';
import { assertValidRange } from '../common/utils/date-range';

interface NotifyPayload {
  type: string;
  title: string;
  message?: string;
  eventId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  // ✅ Overload 1 : usage "simple" (sans transaction)
  async notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void>;

  // ✅ Overload 2 : usage "dans une transaction"
  async notifyUsers(
    prisma: Prisma.TransactionClient | PrismaService,
    userIds: string[],
    payload: NotifyPayload,
  ): Promise<void>;

  async notifyUsers(
    prismaOrUserIds: Prisma.TransactionClient | PrismaService | string[],
    maybeUserIdsOrPayload: string[] | NotifyPayload,
    maybePayload?: NotifyPayload,
  ): Promise<void> {
    let prisma: Prisma.TransactionClient | PrismaService;
    let userIds: string[];
    let payload: NotifyPayload;

    // Cas 1 : notifyUsers(userIds, payload)
    if (Array.isArray(prismaOrUserIds)) {
      prisma = this.prisma;
      userIds = prismaOrUserIds;
      payload = maybeUserIdsOrPayload as NotifyPayload;
    }
    // Cas 2 : notifyUsers(prisma, userIds, payload)
    else {
      prisma = prismaOrUserIds;
      userIds = maybeUserIdsOrPayload as string[];
      payload = maybePayload as NotifyPayload;
    }

    const uniqueIds = [...new Set(userIds)];
    if (!uniqueIds.length) return;

    const authorizedIds: string[] = new Array(uniqueIds.length);
    for (const i of uniqueIds) {
      const allowed = await this.isNotificationEnabled(i, payload.type);
      if (allowed) authorizedIds.push(i);
    }

    await prisma.notification.createMany({
      data: authorizedIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        eventId: payload.eventId,
      })),
    });
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: true,
      },
    });
  }

  async listUserNotifications(
    userId: string,
    query: NotificationsListQueryDto,
  ) {
    const limit = query.limit ?? 30;
    assertValidRange(query.from, query.to);

    const where: any = { userId };

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const items = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: { id: query.cursor },
          }
        : {}),
    });

    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;

    return {
      items: page,
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif || notif.userId !== userId) {
      // Pas besoin d'exposer trop d'info
      return { success: false };
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async getUserPreferences(userId: string) {
    return this.prisma.userNotificationPreference.findMany({
      where: { userId, channel: 'IN_APP' },
      select: {
        type: true,
        enabled: true,
      },
      orderBy: { type: 'asc' },
    });
  }

  async updateUserPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const ops = dto.preferences.map((p) =>
      this.prisma.userNotificationPreference.upsert({
        where: {
          userId_type_channel: {
            userId,
            type: p.type,
            channel: 'IN_APP',
          },
        },
        update: {
          enabled: p.enabled,
        },
        create: {
          userId,
          type: p.type,
          channel: 'IN_APP',
          enabled: p.enabled,
        },
      }),
    );

    await this.prisma.$transaction(ops);

    return {
      updated: dto.preferences.length,
    };
  }

  ///
  //HELPERS
  ///

  private async isNotificationEnabled(
    userId: string,
    type: string,
  ): Promise<boolean> {
    const pref = await this.prisma.userNotificationPreference.findUnique({
      where: {
        userId_type_channel: {
          userId,
          type,
          channel: 'IN_APP',
        },
      },
      select: { enabled: true },
    });

    // Par défaut: autorisé si aucune préférence définie
    return pref ? pref.enabled : true;
  }
}
