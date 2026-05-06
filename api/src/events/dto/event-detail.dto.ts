import {
  EventStatus,
  EventType,
  RsvpStatus,
  PollOptionType,
} from '@prisma/client';

export class EventDetailDto {
  id!: string;
  calendarId!: string;

  title!: string;
  description?: string | null;
  location?: string | null;

  startDateTime!: Date;
  endDateTime!: Date;

  type!: EventType;
  status!: EventStatus;

  createdBy!: { id: string; name?: string | null };

  reminders!: { id: string; minutesBefore: number }[];

  rsvp!: {
    mine: RsvpStatus | null;
    counts: { YES: number; MAYBE: number; NO: number };
  };

  comments!: {
    total: number;
    items: { id: string; userId: string; text: string; createdAt: Date }[];
  };

  files!: {
    total: number;
    items: {
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      createdAt: Date;
    }[];
  };

  poll?: {
    finalizedOptionId?: string | null;
    options: {
      id: string;
      label: string;
      optionType: PollOptionType;
      votesCount: number;
      votedByMe: boolean;
    }[];
  } | null;

  google!: {
    synced: boolean;
    imported: boolean;
    calendarId?: string | null;
    eventId?: string | null;
  };
  permissions!: {
    canEdit: boolean;
    canComment: boolean;
    canRsvp: boolean;
    canDelete: boolean;
  };

  createdAt!: Date;
  updatedAt!: Date;
}
