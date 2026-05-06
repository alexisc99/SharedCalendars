import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Exports')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller('exports')
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Get('calendar/:calendarId/ics')
  async exportICS(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
    @Res() res: Response,
  ) {
    const calendar = await this.exportsService.exportCalendarIcsForUser(
      userId,
      calendarId,
    );

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="calendar-${calendarId}.ics"`,
    );

    res.send(calendar.toString());
  }

  @Get('calendar/:calendarId/csv')
  async exportCSV(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportCalendarCSV(userId, calendarId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="calendar-${calendarId}.csv"`,
    );

    res.send(csv);
  }
}
