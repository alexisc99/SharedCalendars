export type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isPremium: boolean;
    createdAt: string; // ISO
  };
  integrations: {
    googleConnected: boolean;
  };
  notifications: {
    unreadCount: number;
    preferences: any[];
  };
};

export type LoginResponse = {
  success: boolean;
  id: string;
  data: {
    access_token: string;
    user: { id: string; email: string; name: string };
  };
};

export type CalendarSummary = {
  id: string;
  name: string;
  color: string;
  theme: string;
  coverImageUrl: string | null;
  isPremium: boolean;
  publicIcsEnabled: boolean;
  role: "owner" | "admin" | "editor" | "viewer" | "member";
  membersCount: number;
  eventsCount: number;
  createdAt: string; // ISO UTC
};

export type EventListItem = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: string; // ISO UTC
  endDateTime: string; // ISO UTC
  type: string; // "STANDARD" etc (on garde string pour l'instant)
  status: "PUBLISHED" | "PENDING";
  createdBy: { id: string; name: string };
  rsvp: any | null;
  commentsCount: number;
  filesCount: number;
  google: { synced: boolean; imported: boolean; calendarId: string | null };
  createdAt: string;
  updatedAt: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type CursorList<T> = {
  total: number;
  items: T[];
  nextCursor: string | null;
};

export type EventDetail = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  locationAddress: string | null;
  maps: { googleMapsUrl: string | null };
  startDateTime: string;
  endDateTime: string;
  type: string;
  status: "PUBLISHED" | "PENDING";
  createdBy: { id: string; name: string };
  reminders: any[];
  rsvp: {
    mine: "YES" | "MAYBE" | "NO" | null;
    counts: { YES: number; MAYBE: number; NO: number };
  };
  comments: CursorList<any>;
  files: CursorList<any>;
  poll: any | null;
  google: {
    synced: boolean;
    imported: boolean;
    calendarId: string | null;
    eventId: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type CommentItem = {
  id: string;
  eventId: string;
  userId: string;
  text: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isPremium: boolean;
    createdAt: string;
    // NOTE: le backend renvoie aussi "password" actuellement, mais on l'ignore volontairement côté front
  };
};

export type NotificationEventRef = {
  id: string;
  calendarId: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  eventId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type GoogleImportableEvent = {
  googleEventId: string;
  title: string | null;
  start: string | null; // dateTime ISO ou date (YYYY-MM-DD)
  end: string | null;
  allDay: boolean;
  alreadyImported: boolean; // devrait être false car filtré, mais on garde
};

export type GoogleImportableResponse = {
  googleCalendarId: string;
  timeMin: string;
  timeMax: string;
  nextPageToken: string | null;
  items: GoogleImportableEvent[];
};
export type GoogleImportPageResult = {
  googleCalendarId: string;
  timeMin: string;
  timeMax: string;
  nextPageToken: string | null;

  fetchedCount: number;
  importedCount: number;
  skippedDuplicates: number;
  skippedInvalid: number;
};

export type DashboardUpcomingEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  theme: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
};

export type DashboardCalendarActivity = {
  last7d: { eventsCreated: number; eventsPublished: number; comments: number; files: number };
  last30d: { eventsCreated: number; eventsPublished: number; comments: number; files: number };
};

export type DashboardCalendarSummary = {
  id: string;
  name: string;
  theme: string;
  coverImageUrl: string | null;
  role: string;
  isPremium: boolean;
  publicIcsEnabled: boolean;
  membersCount: number;
  eventsCount: number;
  activity: DashboardCalendarActivity;
};

export type DashboardStatsDto = {
  unreadNotifications: number;
  upcomingEvents: DashboardUpcomingEvent[];
  calendars: DashboardCalendarSummary[];
};
