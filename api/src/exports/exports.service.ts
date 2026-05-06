import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateICSCalendar } from './exporters/ics.exporter';
import { generateCSV } from './exporters/csv.exporter';
import { createHash } from 'crypto';

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async exportCalendarIcsForUser(
    userId: string,
    calendarId: string,
  ): Promise<string> {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { id: true, name: true },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');

    const events = await this.prisma.event.findMany({
      where: { calendarId, status: 'PUBLISHED' },
      orderBy: { startDateTime: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        startDateTime: true,
        endDateTime: true,
      },
    });

    const cal = generateICSCalendar({
      calendarName: calendar.name,
      events,
    });

    return cal.toString();
  }

  async exportCalendarIcsPublicByToken(token: string): Promise<{
    ics: string;
    calendarId: string;
    etag: string;
    lastModified: Date;
  }> {
    const calendar = await this.prisma.calendar.findFirst({
      where: { publicIcsEnabled: true, publicIcsToken: token },
      select: { id: true, name: true },
    });
    if (!calendar) throw new NotFoundException('Public calendar not found');

    // Dernière modif = dernier updatedAt des events publiés (fallback now si aucun)
    const agg = await this.prisma.event.aggregate({
      where: { calendarId: calendar.id, status: 'PUBLISHED' },
      _max: { updatedAt: true },
      _count: { _all: true },
    });

    const lastModified = agg._max.updatedAt ?? new Date(0);
    const count = agg._count._all;

    // ETag stable: token + calendarId + lastModified + count
    const etagRaw = `${token}:${calendar.id}:${lastModified.toISOString()}:${count}`;
    const etag = `"${createHash('sha1').update(etagRaw).digest('hex')}"`;

    if (count === 0) {
      const cal = generateICSCalendar({
        calendarName: calendar.name,
        events: [],
      });
      return {
        ics: cal.toString(),
        calendarId: calendar.id,
        etag,
        lastModified,
      };
    }

    const events = await this.prisma.event.findMany({
      where: { calendarId: calendar.id, status: 'PUBLISHED' },
      orderBy: { startDateTime: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        startDateTime: true,
        endDateTime: true,
      },
    });

    const cal = generateICSCalendar({
      calendarName: calendar.name,
      events,
    });

    return { ics: cal.toString(), calendarId: calendar.id, etag, lastModified };
  }

  async exportCalendarCSV(userId: string, calendarId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
    });

    if (!membership) {
      throw new ForbiddenException('Not a calendar member');
    }

    const events = await this.prisma.event.findMany({
      where: {
        calendarId,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        title: true,
        description: true,
        startDateTime: true,
        endDateTime: true,
        calendarId: true,
      },
      orderBy: { startDateTime: 'asc' },
    });

    return generateCSV({ events });
  }
}
