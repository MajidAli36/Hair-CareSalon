import {
  APP_TIMEZONE,
  getLocalDateString,
  isSameLocalDay,
  startOfLocalDay,
} from "@/lib/dates/local";

/** Pakistan calendar day bounds for appointment queries (ISO timestamptz). */
export function getDayRange(date: string) {
  const start = startOfLocalDay(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** @deprecated Prefer isoToLocalDateString from @/lib/dates/local */
export function toLocalDateString(iso: string): string {
  return getLocalDateString(new Date(iso));
}

export { isSameLocalDay, APP_TIMEZONE };
