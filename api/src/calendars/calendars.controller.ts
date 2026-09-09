import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CalendarsService } from './calendars.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { SetMyThemeDto } from './dto/set-my-theme.dto';
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

  @Patch(':id')
  async update(
    @User('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarDto,
  ) {
    const result = await this.calendarsService.update(userId, id, dto);
    return { success: true, id: result.id, data: result };
  }

  @Delete(':id')
  async remove(@User('sub') userId: string, @Param('id') id: string) {
    return this.calendarsService.remove(userId, id);
  }

  @Patch(':id/my-theme')
  async setMyTheme(
    @User('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SetMyThemeDto,
  ) {
    const result = await this.calendarsService.setMyTheme(
      userId,
      id,
      dto.theme,
    );
    return { success: true, data: result };
  }

  @Get(':id/members')
  listMembers(@User('sub') userId: string, @Param('id') id: string) {
    return this.calendarsService.listMembers(userId, id);
  }

  @Patch(':id/members/:userId')
  async updateMemberRole(
    @User('sub') actorUserId: string,
    @Param('id') calendarId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const result = await this.calendarsService.updateMemberRole(
      actorUserId,
      calendarId,
      targetUserId,
      dto.role,
    );
    return { success: true, data: result };
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @User('sub') actorUserId: string,
    @Param('id') calendarId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.calendarsService.removeMember(
      actorUserId,
      calendarId,
      targetUserId,
    );
  }
}
