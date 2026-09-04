/**
 * Salon calendar / day bounds — always Pakistan Standard Time (Asia/Karachi, UTC+5).
 * Never use the server host timezone (Vercel = UTC) for “today” or business dates.
 */

export const APP_TIMEZONE = "Asia/Karachi" as const;
/** Fixed offset used in ISO strings (Pakistan has no DST). */
export const APP_UTC_OFFSET = "+05:00" as const;

const pkDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pkPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pakistanParts(date: Date) {
  const parts = pkPartsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Calendar date YYYY-MM-DD in Pakistan time. */
export function getLocalDateString(date: Date = new Date()): string {
  return pkDateFormatter.format(date);
}

/** Current clock time HH:mm in Pakistan. */
export function getLocalTimeString(date: Date = new Date()): string {
  const { hour, minute } = pakistanParts(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Hour 0–23 in Pakistan (for greetings, slot filters). */
export function getLocalHour(date: Date = new Date()): number {
  return pakistanParts(date).hour;
}

/** Minutes since midnight in Pakistan for an instant. */
export function getLocalMinutesSinceMidnight(date: Date = new Date()): number {
  const { hour, minute } = pakistanParts(date);
  return hour * 60 + minute;
}

/**
 * Day of week for a Pakistan calendar date (0 = Sunday … 6 = Saturday).
 * Uses noon PKT so the calendar day is unambiguous.
 */
export function getLocalDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00${APP_UTC_OFFSET}`).getUTCDay();
}

/**
 * Start of a Pakistan calendar day as a Date (UTC instant).
 * Use for timestamptz range queries.
 */
export function startOfLocalDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${APP_UTC_OFFSET}`);
}

/** End of a Pakistan calendar day as a Date (UTC instant). */
export function endOfLocalDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${APP_UTC_OFFSET}`);
}

/** ISO string for a Pakistan local date + time (HH:mm or HH:mm:ss). */
export function pakistanDateTimeToIso(dateStr: string, timeStr = "00:00:00"): string {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${time}${APP_UTC_OFFSET}`).toISOString();
}

/** Add calendar days in Pakistan (noon anchor avoids edge cases). */
export function addLocalDays(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00${APP_UTC_OFFSET}`);
  anchor.setTime(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  return getLocalDateString(anchor);
}

/** First day of the Pakistan calendar month containing dateStr. */
export function startOfLocalMonth(dateStr: string = getLocalDateString()): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Parse an optional from/to pair into Pakistan day bounds and date labels. */
export function parseLocalDateRange(
  from?: string,
  to?: string,
  defaultSpanDays = 29
): { start: Date; end: Date; fromLabel: string; toLabel: string } {
  const toLabel = to ?? getLocalDateString();
  const end = endOfLocalDay(toLabel);

  const fromLabel = from ?? addLocalDays(toLabel, -defaultSpanDays);
  const start = startOfLocalDay(fromLabel);
  return { start, end, fromLabel, toLabel };
}

/** Group a timestamptz by Pakistan calendar date. */
export function isoToLocalDateString(iso: string): string {
  return getLocalDateString(new Date(iso));
}

/** True when an instant falls on the given Pakistan calendar date. */
export function isSameLocalDay(iso: string, dateStr: string): boolean {
  return isoToLocalDateString(iso) === dateStr;
}
