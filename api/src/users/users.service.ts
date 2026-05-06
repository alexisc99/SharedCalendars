import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MeDto } from './dto/me.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isPremium: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [googleExternal, unreadCount, prefs] = await Promise.all([
      this.prisma.externalCalendar.findFirst({
        where: { userId, provider: 'GOOGLE' },
        select: { id: true },
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
      this.prisma.userNotificationPreference.findMany({
        where: { userId, channel: 'IN_APP' },
        select: { type: true, enabled: true },
        orderBy: { type: 'asc' },
      }),
    ]);

    return {
      user,
      integrations: {
        googleConnected: !!googleExternal,
      },
      notifications: {
        unreadCount,
        preferences: prefs,
      },
    };
  }

  async updateMe(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
