import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Stats')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller('stats')
export class StatsController {
  constructor(
    private statsService: StatsService,
    private prisma: PrismaService,
  ) {}

  @Get('calendar/:calendarId')
  async getCalendarStats(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    // 🔐 INLINE PERMISSION CHECK (owner/admin only)
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Access denied');
    }

    return this.statsService.getCalendarStats(calendarId);
  }
  @Get('group-calendar/:calendarId')
  async getGroupCalendarStats(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    // Permission inline: doit être membre du calendrier
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }

    return this.statsService.getPremiumGroupCalendarStats(calendarId);
  }

  @Get('dashboard')
  async dashboard(@User('sub') userId: string) {
    return this.statsService.getDashboard(userId);
  }
}
