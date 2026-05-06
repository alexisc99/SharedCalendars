import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from '../../auth/decorators/user.decorator';
import { GoogleService } from './google.service';
import { GoogleEventsQueryDto } from './dto/google-events-query.dto';
import { GoogleImportableQueryDto } from './dto/google-importable-query.dto';
import { GoogleImportDto } from './dto/google-import.dto';
import { GoogleExportDto } from './dto/google-export.dto';
import { GoogleImportPageDto } from './dto/google-import-page.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Google Integration')
@ApiBearerAuth('jwt')
@Controller('integrations/google')
export class GoogleController {
  constructor(private googleService: GoogleService) {}

  /* @UseGuards(AuthGuard)
  @Get('connect')
  connect(@User('sub') userId: string, @Res() res: Response) {
    if (!userId) throw new UnauthorizedException();
    const url = this.googleService.generateAuthUrl(userId);
    return res.redirect(url);
  }*/
  //pour le mobile
  @Get('connect-url')
  @UseGuards(AuthGuard)
  connectUrl(
    @User('sub') userId: string,
    @Query('returnUrl') returnUrl: string,
  ) {
    if (!userId) throw new UnauthorizedException();
    if (!returnUrl) throw new BadRequestException('returnUrl required');

    // IMPORTANT: valider returnUrl pour éviter open redirect
    // en dev Expo Go: exp://...
    // en prod: mobile://...
    console.log('[connect-url] returnUrl query =', returnUrl);

    const raw = returnUrl;
    const normalized = raw.includes('%3A%2F%2F')
      ? decodeURIComponent(raw)
      : raw;
    console.log('[connect-url] normalized =', normalized);
    // validate normalized, pas raw
    const ok =
      normalized.startsWith('exp://') || normalized.startsWith('mobile://');
    if (!ok) throw new BadRequestException('invalid returnUrl');

    const url = this.googleService.generateAuthUrl(userId, normalized);
    return { url };
  }

  /**
   * NEW: list google calendars (non-primary support)
   */
  @UseGuards(AuthGuard)
  @Get('calendars')
  async listCalendars(@User('sub') userId: string) {
    return this.googleService.listGoogleCalendars(userId);
  }

  /**
   * UPGRADE: was primary-only, now supports googleCalendarId + timeMin/timeMax + pagination
   * Backward compatible: no query -> defaults to primary + timeMin=now + maxResults=50
   */
  @UseGuards(AuthGuard)
  @Get('events')
  async getEvents(
    @User('sub') userId: string,
    @Query() query: GoogleEventsQueryDto,
  ) {
    return this.googleService.listGoogleCalendarEvents(userId, query);
  }

  @UseGuards(AuthGuard)
  @Post('events/:eventId')
  async pushEventToGoogle(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Body() body: GoogleExportDto,
  ) {
    const result = await this.googleService.createGoogleEventFromMyAppEvent(
      userId,
      eventId,
      body?.googleCalendarId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @UseGuards(AuthGuard)
  @Patch('events/:eventId')
  async updateEventOnGoogle(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
  ) {
    const result = await this.googleService.updateGoogleEventFromMyAppEvent(
      userId,
      eventId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @UseGuards(AuthGuard)
  @Delete('events/:eventId')
  async deleteEventOnGoogle(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.googleService.deleteGoogleEventFromMyAppEvent(userId, eventId);
  }

  @UseGuards(AuthGuard)
  @Post('watch')
  async watchCalendar(@User('sub') userId: string) {
    const result = await this.googleService.watchPrimaryCalendar(userId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * UPGRADE: importable now needs calendarId (MyApp) so anti-doublon is per calendar
   * Supports googleCalendarId + timeMin/timeMax + pagination
   */
  @UseGuards(AuthGuard)
  @Get('events/importable')
  async listImportableEvents(
    @User('sub') userId: string,
    @Query() query: GoogleImportableQueryDto,
  ) {
    return this.googleService.listImportableGoogleEvents(userId, query);
  }

  /**
   * UPGRADE: accepts googleCalendarId (optional)
   */
  @UseGuards(AuthGuard)
  @Post('import')
  async importGoogleEvent(
    @User('sub') userId: string,
    @Body() body: GoogleImportDto,
  ) {
    const result = await this.googleService.importGoogleEvent(
      userId,
      body.googleEventId,
      body.calendarId,
      body.googleCalendarId,
    );
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @UseGuards(AuthGuard)
  @Post('import/page')
  async importGoogleEventsPage(
    @User('sub') userId: string,
    @Body() body: GoogleImportPageDto,
  ) {
    const result = await this.googleService.importGoogleEventsPage(
      userId,
      body,
    );
    return {
      success: true,
      data: result,
    };
  }
}
