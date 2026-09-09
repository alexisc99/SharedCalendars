import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MeDto } from './dto/me.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

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

  async updateMe(userId: string, dto: UpdateMeDto) {
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    // Nettoyage de l'ancienne photo de profil si elle a été remplacée ou
    // retirée : sinon elle reste orpheline sur le disque pour toujours (même
    // logique que pour l'image de couverture d'un calendrier).
    if (
      dto.avatarUrl !== undefined &&
      previous?.avatarUrl &&
      previous.avatarUrl !== dto.avatarUrl &&
      previous.avatarUrl.startsWith('/files/')
    ) {
      const oldFileId = previous.avatarUrl.slice('/files/'.length);
      await this.filesService.deleteFileInternal(oldFileId, userId);
    }

    return updated;
  }
}
