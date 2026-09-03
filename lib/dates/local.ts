/** Calendar date YYYY-MM-DD in the runtime local timezone. */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Start of a local calendar day (for timestamptz range queries). */
export function startOfLocalDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** End of a local calendar day (for timestamptz range queries). */
export function endOfLocalDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`);
}

/** Parse an optional from/to pair into local day bounds and date labels. */
export function parseLocalDateRange(
  from?: string,
  to?: string,
  defaultSpanDays = 29
): { start: Date; end: Date; fromLabel: string; toLabel: string } {
  const toLabel = to ?? getLocalDateString();
  const end = endOfLocalDay(toLabel);

  let fromLabel: string;
  if (from) {
    fromLabel = from;
  } else {
    const anchor = new Date(`${toLabel}T12:00:00`);
    anchor.setDate(anchor.getDate() - defaultSpanDays);
    fromLabel = getLocalDateString(anchor);
  }

  const start = startOfLocalDay(fromLabel);
  return { start, end, fromLabel, toLabel };
}

/** Group a timestamptz by local calendar date. */
export function isoToLocalDateString(iso: string): string {
  return getLocalDateString(new Date(iso));
}
