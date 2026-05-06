import ical, { ICalCalendar } from 'ical-generator';

export function generateICSCalendar({
  calendarName,
  events,
}: {
  calendarName: string;
  events: {
    id: string;
    title: string;
    description?: string | null;
    startDateTime: Date;
    endDateTime: Date;
  }[];
}): ICalCalendar {
  const cal = ical({
    name: calendarName,
    timezone: 'UTC',
    prodId: '//MyApp//Calendar Export//EN',
  });

  for (const event of events) {
    const icsEvent = cal.createEvent({
      summary: event.title,
      description: event.description ?? undefined,
      start: event.startDateTime,
      end: event.endDateTime,
    });

    // UID = ID métier (après création)
    icsEvent.id(event.id);
  }

  return cal;
}
