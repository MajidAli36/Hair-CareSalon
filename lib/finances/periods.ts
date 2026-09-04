import { addLocalDays, getLocalDateString, startOfLocalMonth } from "@/lib/dates/local";
import { formatDate } from "@/lib/format";

export type PeriodPreset = "today" | "week" | "month" | "custom";

export function getPeriodRange(preset: PeriodPreset): { from: string; to: string } {
  const to = getLocalDateString();

  if (preset === "today") return { from: to, to };

  if (preset === "week") {
    return { from: addLocalDays(to, -6), to };
  }

  return { from: startOfLocalMonth(to), to };
}

export function formatPeriodLabel(from: string, to: string): string {
  if (from === to) {
    return formatDate(`${from}T12:00:00+05:00`, "long");
  }
  return `${from} → ${to}`;
}
