import { getLocalDateString } from "@/lib/dates/local";
import { parseLocalDateRange } from "@/lib/dates/local";

export type ReportPeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type ReportTabId =
  | "overall"
  | "sales"
  | "services"
  | "customers"
  | "appointments"
  | "staff"
  | "inventory"
  | "products"
  | "finance"
  | "payments"
  | "dues";

export const REPORT_TABS: { id: ReportTabId; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "sales", label: "Sales" },
  { id: "services", label: "Services" },
  { id: "customers", label: "Customers" },
  { id: "appointments", label: "Appointments" },
  { id: "staff", label: "Staff" },
  { id: "inventory", label: "Inventory" },
  { id: "products", label: "Products" },
  { id: "finance", label: "Finance" },
  { id: "payments", label: "Payments" },
  { id: "dues", label: "Customer dues" },
];

export function isReportTabId(value: string | undefined | null): value is ReportTabId {
  return REPORT_TABS.some((t) => t.id === value);
}

/** Inclusive day count between YYYY-MM-DD strings. */
export function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

/** Previous period of equal length ending the day before `from`. */
export function getPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const span = daysInclusive(from, to);
  const end = new Date(`${from}T12:00:00`);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (span - 1));
  return { from: getLocalDateString(start), to: getLocalDateString(end) };
}

export function getReportPeriodRange(preset: ReportPeriodPreset): { from: string; to: string } {
  const today = new Date();
  const to = getLocalDateString(today);

  switch (preset) {
    case "today":
      return { from: to, to };
    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      const y = getLocalDateString(d);
      return { from: y, to: y };
    }
    case "this_week": {
      const d = new Date(today);
      const day = d.getDay(); // 0 Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + mondayOffset);
      return { from: getLocalDateString(d), to };
    }
    case "last_week": {
      const d = new Date(today);
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(today);
      thisMonday.setDate(d.getDate() + mondayOffset);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6);
      return { from: getLocalDateString(lastMonday), to: getLocalDateString(lastSunday) };
    }
    case "this_month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: getLocalDateString(monthStart), to };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: getLocalDateString(start), to: getLocalDateString(end) };
    }
    case "this_year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { from: getLocalDateString(start), to };
    }
    default:
      return { from: to, to };
  }
}

export function resolveReportRange(from?: string, to?: string) {
  return parseLocalDateRange(from, to);
}

export type CompareResult = {
  current: number;
  previous: number;
  /** null means "New" (previous was 0 and current > 0) */
  changePercent: number | null;
  direction: "up" | "down" | "flat" | "new";
};

export function compareMetric(current: number, previous: number): CompareResult {
  if (previous === 0) {
    if (current === 0) {
      return { current, previous, changePercent: 0, direction: "flat" };
    }
    return { current, previous, changePercent: null, direction: "new" };
  }
  const changePercent = ((current - previous) / Math.abs(previous)) * 100;
  const direction =
    Math.abs(changePercent) < 0.05 ? "flat" : changePercent > 0 ? "up" : "down";
  return { current, previous, changePercent, direction };
}

export function formatCompareLabel(compare: CompareResult): string {
  if (compare.direction === "new") return "New";
  if (compare.changePercent === null) return "New";
  const sign = compare.changePercent > 0 ? "+" : "";
  return `${sign}${compare.changePercent.toFixed(1)}%`;
}
