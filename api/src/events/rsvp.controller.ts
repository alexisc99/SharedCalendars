import { Controller, UseGuards, Post, Get, Param, Body } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { RsvpService } from './rsvp.service';
import { RsvpDto } from './dto/rsvp.dto';

@UseGuards(AuthGuard)
@Controller('events/:eventId/rsvp')
export class RsvpController {
  constructor(private readonly rsvpService: RsvpService) {}

  @Post()
  async respond(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Body() dto: RsvpDto,
  ) {
    const result = await this.rsvpService.respondToEvent(userId, eventId, dto);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Get()
  list(@User('sub') userId: string, @Param('eventId') eventId: string) {
    return this.rsvpService.listRsvps(userId, eventId);
  }
}
