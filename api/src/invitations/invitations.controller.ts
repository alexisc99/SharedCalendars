import { Controller, Post, Get, Param, Req, UseGuards } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller()
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Post('calendars/:id/invitations')
  async createInvitation(
    @User('sub') userId: string,
    @Param('id') calendarId: string,
  ) {
    const result = await this.invitationsService.createInvitation(
      calendarId,
      userId,
    );
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Get('invitations/:token')
  acceptInvitation(
    @User('sub') userId: string, // <--- CORRECTION CRITIQUE
    @Param('token') token: string,
  ) {
    return this.invitationsService.acceptInvitation(token, userId);
  }
}
