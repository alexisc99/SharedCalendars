import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PollService } from './poll.service';
import { User } from '../auth/decorators/user.decorator';

@UseGuards(AuthGuard)
@Controller('events/:eventId/poll')
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post('options/:optionId/vote')
  async vote(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Param('optionId') optionId: string,
  ) {
    const result = await this.pollService.vote(userId, eventId, optionId);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Delete('options/:optionId/vote')
  async unvote(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Param('optionId') optionId: string,
  ) {
    const result = await this.pollService.unvote(userId, eventId, optionId);
    return {
      success: true,
      data: result,
    };
  }

  @Post('finalize/:optionId')
  async finalizePoll(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Param('optionId') optionId: string,
  ) {
    const result = await this.pollService.finalizePoll(
      userId,
      eventId,
      optionId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get()
  getPoll(@User('sub') userId: string, @Param('eventId') eventId: string) {
    return this.pollService.getPoll(eventId, userId);
  }
}
