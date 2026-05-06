export type EventsCursor = { startDateTime: string; id: string };

export function encodeEventsCursor(c: EventsCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64');
}

export function decodeEventsCursor(cursor: string): EventsCursor {
  const raw = Buffer.from(cursor, 'base64').toString('utf8');
  const parsed = JSON.parse(raw);

  if (
    !parsed ||
    typeof parsed.startDateTime !== 'string' ||
    typeof parsed.id !== 'string'
  ) {
    throw new Error('Invalid cursor');
  }

  return parsed;
}
