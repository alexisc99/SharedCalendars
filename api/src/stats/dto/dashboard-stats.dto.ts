import { MemberRole } from '@prisma/client';

export class DashboardCalendarActivityDto {
  last7d!: {
    eventsCreated: number;
    eventsPublished: number;
    comments: number;
    files: number;
  };
  last30d!: {
    eventsCreated: number;
    eventsPublished: number;
    comments: number;
    files: number;
  };
}

export class DashboardCalendarDto {
  id!: string;
  name!: string;
  theme!: string;
  coverImageUrl!: string | null;
  role!: MemberRole;
  isPremium!: boolean;
  publicIcsEnabled!: boolean;
  membersCount!: number;
  eventsCount!: number;
  activity!: DashboardCalendarActivityDto;
}

export class DashboardUpcomingEventDto {
  id!: string;
  calendarId!: string;
  calendarName!: string;
  theme!: string;
  title!: string;
  startDateTime!: Date;
  endDateTime!: Date;
}

export class DashboardStatsDto {
  unreadNotifications!: number;
  upcomingEvents!: DashboardUpcomingEventDto[];
  calendars!: DashboardCalendarDto[];
}
