import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { User } from '../auth/decorators/user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CalendarEventsQueryDto } from './dto/calendar-events-query.dto';
import { EventDetailQueryDto } from './dto/event-detail-query.dto';

@ApiTags('Events')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('calendars/:calendarId/events')
  async create(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
    @Body() dto: CreateEventDto,
  ) {
    const result = await this.eventsService.createEvent(
      userId,
      calendarId,
      dto,
    );
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Get('/calendars/:calendarId/events')
  async listEventsForCalendar(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
    @Query() query: CalendarEventsQueryDto,
  ) {
    return this.eventsService.listEventsForCalendarPaged(
      userId,
      calendarId,
      query,
    );
  }

  @Get('events/feed')
  async getFeed(
    @User('sub') userId: string,
    @Query() query: CalendarEventsQueryDto,
  ) {
    return this.eventsService.getUserFeed(userId, query);
  }

  @Get('events/:eventId')
  getOne(@User('sub') userId: string, @Param('eventId') eventId: string) {
    return this.eventsService.getEvent(userId, eventId);
  }

  @Get('events/:eventId/detail')
  getEventDetail(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Query() query: EventDetailQueryDto,
  ) {
    return this.eventsService.getEventDetail(userId, eventId, query);
  }

  @Patch('events/:eventId')
  async update(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    const result = await this.eventsService.updateEvent(userId, eventId, dto);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Delete('events/:eventId')
  delete(@User('sub') userId: string, @Param('eventId') eventId: string) {
    return this.eventsService.deleteEvent(userId, eventId);
  }

  @Patch(':eventId/publish')
  async publish(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
  ) {
    const result = await this.eventsService.publishEvent(userId, eventId);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Patch(':eventId/reject')
  reject(@User('sub') userId: string, @Param('eventId') eventId: string) {
    return this.eventsService.rejectEvent(userId, eventId);
  }
}
