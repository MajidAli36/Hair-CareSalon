import { getLocalDateString } from "@/lib/dates/local";
import { formatDate } from "@/lib/format";

export type PeriodPreset = "today" | "week" | "month" | "custom";

export function getPeriodRange(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date();
  const to = getLocalDateString(today);

  if (preset === "today") return { from: to, to };

  if (preset === "week") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: getLocalDateString(d), to };
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: getLocalDateString(monthStart), to };
}

export function formatPeriodLabel(from: string, to: string): string {
  if (from === to) {
    return formatDate(`${from}T12:00:00`, "long");
  }
  return `${from} → ${to}`;
}
