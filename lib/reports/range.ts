import {
  addLocalDays,
  getLocalDateString,
  getLocalDayOfWeek,
  parseLocalDateRange,
  startOfLocalMonth,
} from "@/lib/dates/local";

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

/** Inclusive day count between YYYY-MM-DD strings (Pakistan calendar). */
export function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00+05:00`).getTime();
  const b = new Date(`${to}T12:00:00+05:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Previous period of equal length ending the day before `from`. */
export function getPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const span = daysInclusive(from, to);
  const end = addLocalDays(from, -1);
  const start = addLocalDays(end, -(span - 1));
  return { from: start, to: end };
}

export function getReportPeriodRange(preset: ReportPeriodPreset): { from: string; to: string } {
  const to = getLocalDateString();

  switch (preset) {
    case "today":
      return { from: to, to };
    case "yesterday": {
      const y = addLocalDays(to, -1);
      return { from: y, to: y };
    }
    case "this_week": {
      const dow = getLocalDayOfWeek(to);
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      return { from: addLocalDays(to, mondayOffset), to };
    }
    case "last_week": {
      const dow = getLocalDayOfWeek(to);
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const thisMonday = addLocalDays(to, mondayOffset);
      const lastSunday = addLocalDays(thisMonday, -1);
      const lastMonday = addLocalDays(lastSunday, -6);
      return { from: lastMonday, to: lastSunday };
    }
    case "this_month":
      return { from: startOfLocalMonth(to), to };
    case "last_month": {
      const thisMonthStart = startOfLocalMonth(to);
      const lastMonthEnd = addLocalDays(thisMonthStart, -1);
      return { from: startOfLocalMonth(lastMonthEnd), to: lastMonthEnd };
    }
    case "this_year":
      return { from: `${to.slice(0, 4)}-01-01`, to };
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
