const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const monthYearFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function formatDate(iso: string | Date): string {
  return dateFormatter.format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string | Date): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatMonthYear(date: Date): string {
  return capitalize(monthYearFormatter.format(date));
}

/** "8 sept. 2026 · 14:00 – 16:00" si même jour, sinon "8 sept. 2026 14:00 → 9 sept. 2026 09:00" */
export function formatEventRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (isSameDay(start, end)) {
    return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  return `${formatDateTime(start)} → ${formatDateTime(end)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** "1 jour avant", "2 heures avant", "1 h 30 avant", "15 minutes avant"… */
export function formatLeadTime(minutesBefore: number): string {
  if (minutesBefore % 1440 === 0) {
    const days = minutesBefore / 1440;
    return `${days} jour${days > 1 ? "s" : ""} avant`;
  }
  if (minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60;
    return `${hours} heure${hours > 1 ? "s" : ""} avant`;
  }
  if (minutesBefore > 60) {
    const hours = Math.floor(minutesBefore / 60);
    const rest = minutesBefore % 60;
    return `${hours} h ${String(rest).padStart(2, "0")} avant`;
  }
  return `${minutesBefore} minute${minutesBefore > 1 ? "s" : ""} avant`;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
