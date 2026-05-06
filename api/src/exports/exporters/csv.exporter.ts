export function generateCSV({
  events,
}: {
  events: {
    id: string;
    title: string;
    description?: string | null;
    startDateTime: Date;
    endDateTime: Date;
    calendarId: string;
  }[];
}): string {
  const header = [
    'eventId',
    'title',
    'description',
    'startDateTime',
    'endDateTime',
    'calendarId',
  ].join(',');

  const rows = events.map((event) =>
    [
      event.id,
      escapeCSV(event.title),
      escapeCSV(event.description ?? ''),
      event.startDateTime.toISOString(),
      event.endDateTime.toISOString(),
      event.calendarId,
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
