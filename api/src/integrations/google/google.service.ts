import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExternalCalendar } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import * as jwt from 'jsonwebtoken';
import { GoogleEventsQueryDto } from './dto/google-events-query.dto';
import { GoogleImportableQueryDto } from './dto/google-importable-query.dto';
import { GoogleImportPageDto } from './dto/google-import-page.dto';
import {
  encryptString,
  decryptString,
} from 'src/common/crypto/field-encryption';

@Injectable()
export class GoogleService {
  private oauthClient;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {
    this.oauthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  generateAuthUrl(userId: string, returnUrl: string) {
    const state = jwt.sign(
      { sub: userId, returnUrl },
      process.env.JWT_SECRET!,
      { expiresIn: '10m' },
    );

    return this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent',
      state,
    });
  }
  decodeState(state: string) {
    // vérifie + récupère payload
    const payload = jwt.verify(state, process.env.JWT_SECRET!) as any;
    return payload?.returnUrl;
  }
  async getTokens(code: string) {
    const { tokens } = await this.oauthClient.getToken(code);
    return tokens;
  }

  verifyState(state: string): string {
    try {
      const payload = jwt.verify(state, process.env.JWT_SECRET!) as {
        sub: string;
      };
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  async handleOAuthCallback(state: string, code: string) {
    const userId = this.verifyState(state);

    const { tokens } = await this.oauthClient.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new UnauthorizedException('Invalid Google OAuth tokens');
    }

    await this.prisma.externalCalendar.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'GOOGLE',
        },
      },
      update: {
        accessToken: encryptString(tokens.access_token),
        refreshToken: encryptString(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date),
      },
      create: {
        userId,
        provider: 'GOOGLE',
        accessToken: encryptString(tokens.access_token),
        refreshToken: encryptString(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date),
      },
    });

    return { message: 'Google account connected' };
  }

  private getOAuthClient(external: ExternalCalendar) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    client.setCredentials({
      access_token: decryptString(external.accessToken),
      refresh_token: decryptString(external.refreshToken),
      expiry_date: external.expiresAt?.getTime(),
    });

    return client;
  }

  private async ensureFreshToken(external: ExternalCalendar, oauth: any) {
    const isExpired =
      !external.expiresAt || external.expiresAt.getTime() < Date.now();
    if (!isExpired) return;

    // Keeping your current approach for compatibility
    const { credentials } = await oauth.refreshAccessToken();

    await this.prisma.externalCalendar.update({
      where: { id: external.id },
      data: {
        accessToken: encryptString(credentials.access_token!),
        expiresAt: new Date(credentials.expiry_date!),
      },
    });

    oauth.setCredentials(credentials);
  }

  private async getConnectedExternal(userId: string) {
    const external = await this.prisma.externalCalendar.findFirst({
      where: { userId, provider: 'GOOGLE' },
    });

    if (!external)
      throw new ForbiddenException('Google calendar not connected');
    return external;
  }

  /**
   * NEW: list calendars available to the user (supports non-primary selection)
   */
  async listGoogleCalendars(userId: string) {
    const external = await this.getConnectedExternal(userId);

    const oauth = this.getOAuthClient(external);
    await this.ensureFreshToken(external, oauth);

    const calendarApi = google.calendar({ version: 'v3', auth: oauth });

    const res = await calendarApi.calendarList.list({
      maxResults: 250,
      minAccessRole: 'reader',
    });

    const items =
      (res.data.items ?? []).map((c) => ({
        id: c.id!,
        summary: c.summary ?? null,
        primary: c.primary ?? null,
        accessRole: c.accessRole ?? null,
        timeZone: c.timeZone ?? null,
      })) ?? [];

    // stable order: primary first then alpha
    items.sort((a, b) => {
      const ap = a.primary ? 0 : 1;
      const bp = b.primary ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.summary ?? '').localeCompare(b.summary ?? '');
    });

    return items;
  }

  /**
   * NEW/UPGRADE: list events from any google calendar, with filters + pagination
   * Defaults match your existing behavior closely:
   * - googleCalendarId = "primary"
   * - maxResults = 50
   * - timeMin = now (if not provided)
   */
  async listGoogleCalendarEvents(userId: string, query: GoogleEventsQueryDto) {
    const external = await this.getConnectedExternal(userId);

    const oauth = this.getOAuthClient(external);
    await this.ensureFreshToken(external, oauth);

    const calendarApi = google.calendar({ version: 'v3', auth: oauth });

    const googleCalendarId = query.googleCalendarId?.trim() || 'primary';
    const timeMin = query.timeMin ?? new Date().toISOString();

    const res = await calendarApi.events.list({
      calendarId: googleCalendarId,
      maxResults: query.maxResults ?? 50,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin,
      timeMax: query.timeMax,
      pageToken: query.pageToken,
      showDeleted: false,
    });

    return {
      googleCalendarId,
      timeMin,
      timeMax: query.timeMax ?? null,
      nextPageToken: res.data.nextPageToken ?? null,
      items: res.data.items ?? [],
    };
  }

  // Backward compatibility: keep method, but delegate
  async listPrimaryCalendarEvents(userId: string) {
    const res = await this.listGoogleCalendarEvents(userId, {
      googleCalendarId: 'primary',
    });
    return res.items;
  }

  async createGoogleEventFromMyAppEvent(
    userId: string,
    eventId: string,
    googleCalendarId?: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Permission inline
    await this.assertCanEditEventCalendar(userId, event.calendarId);

    const myAppCalendar = await this.prisma.calendar.findUnique({
      where: { id: event.calendarId },
      select: { syncMode: true },
    });

    if (myAppCalendar?.syncMode === 'NONE') {
      throw new ForbiddenException('Google sync disabled for this calendar');
    }

    if (event.status !== 'PUBLISHED') {
      throw new ForbiddenException(
        'Only published events can be synced to Google',
      );
    }

    // If already synced, keep behavior but also return calendar target info
    if (event.googleEventId) {
      return {
        googleEventId: event.googleEventId,
        googleCalendarId: event.googleCalendarId ?? 'primary',
        message: 'Event already synced to Google',
      };
    }

    const external = await this.prisma.externalCalendar.findFirst({
      where: { userId, provider: 'GOOGLE' },
    });

    if (!external) {
      throw new ForbiddenException('Google calendar not connected');
    }

    const oauth = this.getOAuthClient(external);
    await this.ensureFreshToken(external, oauth);

    const calendarApi = google.calendar({ version: 'v3', auth: oauth });

    const targetGoogleCalendarId = googleCalendarId?.trim() || 'primary';

    const googleEvent = {
      summary: event.title,
      description: event.description ?? undefined,
      start: { dateTime: event.startDateTime.toISOString() },
      end: { dateTime: event.endDateTime.toISOString() },
    };

    const res = await calendarApi.events.insert({
      calendarId: targetGoogleCalendarId,
      requestBody: googleEvent,
    });

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        googleEventId: res.data.id!,
        googleCalendarId: targetGoogleCalendarId,
        googleSyncedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      action: 'GOOGLE_EVENT_EXPORTED',
      entity: 'Event',
      entityId: event.id,
      metadata: {
        googleEventId: res.data.id!,
        googleCalendarId: targetGoogleCalendarId,
      },
    });

    return {
      googleEventId: res.data.id,
      googleCalendarId: targetGoogleCalendarId,
      htmlLink: res.data.htmlLink,
    };
  }

  async updateGoogleEventFromMyAppEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) throw new NotFoundException('Event not found');

    await this.assertCanEditEventCalendar(userId, event.calendarId);

    if (event.status !== 'PUBLISHED') {
      throw new ForbiddenException(
        'Only published events can be synced to Google',
      );
    }

    if (!event.googleEventId) {
      throw new ForbiddenException('Event is not synced to Google');
    }

    const external = await this.getConnectedExternal(userId);

    const oauth = this.getOAuthClient(external);
    await this.ensureFreshToken(external, oauth);

    const calendarApi = google.calendar({ version: 'v3', auth: oauth });

    const googleEvent = {
      summary: event.title,
      description: event.description ?? undefined,
      start: { dateTime: event.startDateTime.toISOString() },
      end: { dateTime: event.endDateTime.toISOString() },
    };

    const targetGoogleCalendarId = event.googleCalendarId?.trim() || 'primary';

    const res = await calendarApi.events.update({
      calendarId: targetGoogleCalendarId,
      eventId: event.googleEventId,
      requestBody: googleEvent,
    });

    await this.prisma.event.update({
      where: { id: event.id },
      data: { googleSyncedAt: new Date() },
    });
    await this.auditService.log({
      userId,
      action: 'GOOGLE_EVENT_UPDATED',
      entity: 'Event',
      entityId: event.id,
      metadata: {
        googleEventId: event.googleEventId,
        googleCalendarId: event.googleCalendarId ?? 'primary',
      },
    });

    return {
      googleEventId: res.data.id,
      htmlLink: res.data.htmlLink,
      message: 'Google event updated',
    };
  }

  async deleteGoogleEventFromMyAppEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanEditEventCalendar(userId, event.calendarId);

    if (!event.googleEventId) {
      return { message: 'Event was not synced to Google' };
    }

    const external = await this.getConnectedExternal(userId);

    const oauth = this.getOAuthClient(external);
    await this.ensureFreshToken(external, oauth);

    const calendarApi = google.calendar({ version: 'v3', auth: oauth });

    const targetGoogleCalendarId = event.googleCalendarId?.trim() || 'primary';

    try {
      await calendarApi.events.delete({
        calendarId: targetGoogleCalendarId,
        eventId: event.googleEventId,
      });
    } catch (err: any) {
      if (err.code !== 410 && err.code !== 404) throw err;
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        googleEventId: null,
        googleCalendarId: null,
        googleSyncedAt: null,
      },
    });
    await this.auditService.log({
      userId,
      action: 'GOOGLE_EVENT_DELETED',
      entity: 'Event',
      entityId: event.id,
      metadata: {
        googleEventId: event.googleEventId,
        googleCalendarId: event.googleCalendarId ?? 'primary',
      },
    });

    return { success: true, message: 'Google event deleted' };
  }

  async watchPrimaryCalendar(userId: string) {
    const external = await this.getConnectedExternal(userId);

    const oauth = this.getOAuthClient(external);
    await this.ensureFreshToken(external, oauth);

    const calendarApi = google.calendar({ version: 'v3', auth: oauth });

    const channelId = randomUUID();
    const res = await calendarApi.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: `${process.env.PUBLIC_API_URL}/integrations/google/webhook`,
      },
    });

    await this.prisma.googleWatchChannel.create({
      data: {
        id: channelId,
        userId,
        resourceId: res.data.resourceId!,
        expiration: new Date(Number(res.data.expiration)),
      },
    });

    return { channelId };
  }

  /**
   * UPGRADE: now per MyApp calendar anti-doublon + supports non-primary + pagination
   */
  async listImportableGoogleEvents(
    userId: string,
    query: GoogleImportableQueryDto,
  ) {
    // Permission inline: must at least have access (viewer allowed to list importable)
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId: query.calendarId, userId },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }

    const res = await this.listGoogleCalendarEvents(userId, query);

    // Only exclude events already imported into THIS MyApp calendar
    const imported = await this.prisma.event.findMany({
      where: {
        calendarId: query.calendarId,
        googleEventId: { not: null },
        source: 'GOOGLE',
      },
      select: { googleEventId: true },
    });

    const importedIds = new Set(
      imported.map((e) => e.googleEventId).filter(Boolean) as string[],
    );

    const items = (res.items ?? [])
      .filter((e: any) => e.id)
      .map((e: any) => ({
        googleEventId: e.id!,
        title: e.summary ?? null,
        start: e.start?.dateTime || e.start?.date || null,
        end: e.end?.dateTime || e.end?.date || null,
        allDay: !!e.start?.date,
        alreadyImported: importedIds.has(e.id!),
      }))
      .filter((x) => !x.alreadyImported); // keep “importable” strict

    return {
      googleCalendarId: res.googleCalendarId,
      timeMin: res.timeMin,
      timeMax: res.timeMax,
      nextPageToken: res.nextPageToken,
      items,
    };
  }

  async importGoogleEvent(
    userId: string,
    googleEventId: string,
    calendarId: string,
    googleCalendarId?: string,
  ) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }
    if (membership.role === 'viewer') {
      throw new ForbiddenException('You cannot import events in this calendar');
    }

    // Anti-doublon PER CALENDAR (compatible with @@unique([calendarId, googleEventId]))
    const existing = await this.prisma.event.findFirst({
      where: { calendarId, googleEventId },
      select: { id: true },
    });
    if (existing) {
      throw new ForbiddenException('This Google event was already imported');
    }

    const [user, calendar] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { isPremium: true },
      }),
      this.prisma.calendar.findUnique({
        where: { id: calendarId },
        select: { isPremium: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!calendar) throw new NotFoundException('Calendar not found');

    const hasPremiumForReminders = user.isPremium || calendar.isPremium;

    const ext = await this.prisma.externalCalendar.findFirst({
      where: { userId, provider: 'GOOGLE' },
    });
    if (!ext) throw new ForbiddenException('Google account not connected');

    // Keep your existing oauthClient usage here
    this.oauthClient.setCredentials({
      access_token: decryptString(ext.accessToken),
      refresh_token: decryptString(ext.refreshToken),
    });

    const calendarApi = google.calendar({
      version: 'v3',
      auth: this.oauthClient,
    });

    const targetGoogleCalendarId = googleCalendarId?.trim() || 'primary';

    const googleEvent = await calendarApi.events.get({
      calendarId: targetGoogleCalendarId,
      eventId: googleEventId,
    });

    const g = googleEvent.data;
    if (!g) throw new NotFoundException('Google event not found');

    const startRaw = g.start?.dateTime ?? g.start?.date;
    const endRaw = g.end?.dateTime ?? g.end?.date;

    if (!startRaw || !endRaw) {
      throw new ForbiddenException('Google event has no valid start/end');
    }

    // Reminders import (as you already do)
    let reminderMinutes: number[] = [];

    const reminders = g.reminders;
    if (
      reminders &&
      reminders.useDefault === false &&
      Array.isArray(reminders.overrides)
    ) {
      reminderMinutes = reminders.overrides
        .map((o) => o?.minutes)
        .filter(
          (m): m is number =>
            typeof m === 'number' && Number.isFinite(m) && m >= 0,
        );

      reminderMinutes = Array.from(new Set(reminderMinutes)).sort(
        (a, b) => a - b,
      );
    }

    if (!hasPremiumForReminders && reminderMinutes.length > 1) {
      reminderMinutes = reminderMinutes.slice(0, 1);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          calendarId,
          creatorId: userId,

          title: g.summary ?? '(No title)',
          description: g.description ?? null,
          location: g.location ?? null,

          startDateTime: new Date(startRaw),
          endDateTime: new Date(endRaw),

          type: 'STANDARD',
          status: 'PUBLISHED',

          googleEventId,
          googleCalendarId: targetGoogleCalendarId,
          googleImportedAt: new Date(),
          source: 'GOOGLE',
        },
      });

      if (reminderMinutes.length > 0) {
        await tx.eventReminder.createMany({
          data: reminderMinutes.map((minutesBefore) => ({
            eventId: event.id,
            minutesBefore,
          })),
        });
      }

      return event;
    });

    await this.auditService.log({
      userId,
      action: 'GOOGLE_EVENT_IMPORTED',
      entity: 'Event',
      entityId: created.id,
      metadata: {
        calendarId,
        googleEventId,
        googleCalendarId: targetGoogleCalendarId,
        remindersImported: reminderMinutes.length,
        remindersMinutes: reminderMinutes,
        limitedByPremium: !hasPremiumForReminders,
      },
    });

    return created;
  }

  async importGoogleEventsPage(userId: string, dto: GoogleImportPageDto) {
    const { calendarId } = dto;

    // 1) Permission inline
    await this.assertCanImportIntoCalendar(userId, calendarId);

    // 2) Premium rules for reminders (same logic as unit import)
    const [user, calendar] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { isPremium: true },
      }),
      this.prisma.calendar.findUnique({
        where: { id: calendarId },
        select: { isPremium: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!calendar) throw new NotFoundException('Calendar not found');

    const hasPremiumForReminders = user.isPremium || calendar.isPremium;

    // 3) Fetch one page from Google (live)
    const res = await this.listGoogleCalendarEvents(userId, dto);
    const googleCalendarId = res.googleCalendarId;

    const rawItems = res.items ?? [];
    const candidates = rawItems.filter(
      (e: any) => !!e?.id && !!e?.start && !!e?.end,
    );

    if (candidates.length === 0) {
      return {
        googleCalendarId,
        timeMin: res.timeMin,
        timeMax: res.timeMax,
        nextPageToken: res.nextPageToken,
        fetchedCount: rawItems.length,
        importedCount: 0,
        skippedDuplicates: 0,
        skippedInvalid: rawItems.length,
      };
    }

    // 4) Anti-doublon per MyApp calendar
    const ids = candidates.map((e: any) => e.id as string);
    const existing = await this.prisma.event.findMany({
      where: { calendarId, googleEventId: { in: ids } },
      select: { googleEventId: true },
    });
    const existingSet = new Set(
      existing.map((x) => x.googleEventId!).filter(Boolean),
    );

    const toImport = candidates.filter((e: any) => !existingSet.has(e.id));

    // 5) Create events + reminders (transaction)
    const createdEvents: { id: string; googleEventId: string }[] = [];
    let skippedInvalid = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const g of toImport) {
        try {
          const { start, end } = this.extractStartEndFromGoogle(g);
          const reminderMinutes = this.extractReminderMinutesFromGoogle(
            g,
            hasPremiumForReminders,
          );

          const created = await tx.event.create({
            data: {
              calendarId,
              creatorId: userId,

              title: g.summary ?? '(No title)',
              description: g.description ?? null,
              location: g.location ?? null,

              startDateTime: start,
              endDateTime: end,

              type: 'STANDARD',
              status: 'PUBLISHED',

              googleEventId: g.id,
              googleCalendarId,
              googleImportedAt: new Date(),
              source: 'GOOGLE',
            },
            select: { id: true, googleEventId: true },
          });

          if (reminderMinutes.length > 0) {
            await tx.eventReminder.createMany({
              data: reminderMinutes.map((minutesBefore) => ({
                eventId: created.id,
                minutesBefore,
              })),
            });
          }

          createdEvents.push({
            id: created.id,
            googleEventId: created.googleEventId!,
          });
        } catch {
          skippedInvalid += 1;
        }
      }
    });

    // 6) Audit (one per created event, consistent with existing unit import)
    for (const ev of createdEvents) {
      await this.auditService.log({
        userId,
        action: 'GOOGLE_EVENT_IMPORTED',
        entity: 'Event',
        entityId: ev.id,
        metadata: {
          calendarId,
          googleEventId: ev.googleEventId,
          googleCalendarId,
          limitedByPremium: !hasPremiumForReminders,
          bulk: true,
        },
      });
    }

    return {
      googleCalendarId,
      timeMin: res.timeMin,
      timeMax: res.timeMax,
      nextPageToken: res.nextPageToken,

      fetchedCount: rawItems.length,
      importedCount: createdEvents.length,
      skippedDuplicates: candidates.length - toImport.length,
      skippedInvalid,
    };
  }
  ////////
  //HELPERS
  ////////
  private async assertCanEditEventCalendar(userId: string, calendarId: string) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }
    if (membership.role === 'viewer' || membership.role === 'member') {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
  private async assertCanImportIntoCalendar(
    userId: string,
    calendarId: string,
  ) {
    const membership = await this.prisma.calendarMember.findFirst({
      where: { calendarId, userId },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this calendar');
    }
    if (membership.role === 'viewer' || membership.role === 'member') {
      throw new ForbiddenException('You cannot import events in this calendar');
    }
  }

  private extractStartEndFromGoogle(g: any): {
    start: Date;
    end: Date;
    allDay: boolean;
  } {
    const startRaw = g.start?.dateTime ?? g.start?.date;
    const endRaw = g.end?.dateTime ?? g.end?.date;

    if (!startRaw || !endRaw) {
      throw new ForbiddenException('Google event has no valid start/end');
    }

    const allDay = !!g.start?.date && !g.start?.dateTime;
    return {
      start: new Date(startRaw),
      end: new Date(endRaw),
      allDay,
    };
  }

  private extractReminderMinutesFromGoogle(
    g: any,
    hasPremiumForReminders: boolean,
  ): number[] {
    let reminderMinutes: number[] = [];

    const reminders = g.reminders;
    if (
      reminders &&
      reminders.useDefault === false &&
      Array.isArray(reminders.overrides)
    ) {
      reminderMinutes = reminders.overrides
        .map((o: any) => o?.minutes)
        .filter(
          (m: any): m is number =>
            typeof m === 'number' && Number.isFinite(m) && m >= 0,
        );

      reminderMinutes = Array.from(new Set(reminderMinutes)).sort(
        (a, b) => a - b,
      );
    }

    if (!hasPremiumForReminders && reminderMinutes.length > 1) {
      reminderMinutes = reminderMinutes.slice(0, 1);
    }

    return reminderMinutes;
  }
}
