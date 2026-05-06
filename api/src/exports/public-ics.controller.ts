import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ExportsService } from './exports.service';

@ApiTags('Public')
@Controller('public/calendars')
export class PublicIcsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':token/ics')
  async getPublicCalendarIcs(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { ics, calendarId, etag, lastModified } =
      await this.exportsService.exportCalendarIcsPublicByToken(token);

    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    // Comparaison ETag en priorité
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', lastModified.toUTCString());
      return res.send();
    }

    // Fallback If-Modified-Since
    if (ifModifiedSince) {
      const since = new Date(ifModifiedSince).getTime();
      if (!Number.isNaN(since) && lastModified.getTime() <= since) {
        res.status(304);
        res.setHeader('ETag', etag);
        res.setHeader('Last-Modified', lastModified.toUTCString());
        return res.send();
      }
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified.toUTCString());
    res.setHeader('X-Calendar-Id', calendarId);

    return res.send(ics);
  }
}
