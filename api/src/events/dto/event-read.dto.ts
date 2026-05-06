import { EventStatus, EventType, RsvpStatus } from '@prisma/client';

export class EventReadDto {
  id!: string;
  calendarId!: string;

  title!: string;
  description?: string | null;
  location?: string | null;

  startDateTime!: Date;
  endDateTime!: Date;

  type!: EventType;
  status!: EventStatus;

  createdBy!: {
    id: string;
    name?: string | null;
  };

  rsvp?: RsvpStatus | null;

  commentsCount!: number;
  filesCount!: number;

  google!: {
    synced: boolean;
    imported: boolean;
    calendarId?: string | null;
  };

  createdAt!: Date;
  updatedAt!: Date;
}
