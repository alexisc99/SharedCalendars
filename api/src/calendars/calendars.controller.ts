import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CalendarsService } from './calendars.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { User } from '../auth/decorators/user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Calendars')
@ApiBearerAuth('jwt')
@Controller('calendars')
@UseGuards(AuthGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Post()
  async create(
    @User('sub') userId: string, // <--- IMPORTANT : 'sub', pas 'id'
    @Body() dto: CreateCalendarDto,
  ) {
    const result = await this.calendarsService.create(userId, dto);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Get()
  findMine(@Req() req) {
    return this.calendarsService.findUserCalendars(req.user.userId);
  }
  @Get('my')
  async myCalendars(@User('sub') userId: string) {
    return this.calendarsService.findUserCalendarsSummary(userId);
  }
  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.calendarsService.findOne(id, req.user.userId);
  }

  @Get(':calendarId/home')
  async calendarHome(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    return this.calendarsService.getCalendarHome(userId, calendarId);
  }

  @Post(':calendarId/public-ics/enable')
  async enablePublicIcs(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    const result = await this.calendarsService.enablePublicIcs(
      userId,
      calendarId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post(':calendarId/public-ics/rotate')
  async rotatePublicIcs(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    const result = await this.calendarsService.rotatePublicIcs(
      userId,
      calendarId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post(':calendarId/public-ics/disable')
  async disablePublicIcs(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    const result = await this.calendarsService.disablePublicIcs(
      userId,
      calendarId,
    );
    return {
      success: true,
      data: result,
    };
  }
}
