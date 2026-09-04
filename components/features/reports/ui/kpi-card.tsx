"use client";

import { cn } from "@/lib/utils";
import { formatCompareLabel, type CompareResult } from "@/lib/reports/range";

type KpiCardProps = {
  label: string;
  value: string;
  compare?: CompareResult | null;
  hint?: string;
  /** When true, up is bad (e.g. refunds). */
  invertTrend?: boolean;
  className?: string;
};

export function KpiCard({
  label,
  value,
  compare,
  hint,
  invertTrend = false,
  className,
}: KpiCardProps) {
  let changeClass = "text-muted-foreground";
  let changeText: string | null = null;

  if (compare) {
    changeText = formatCompareLabel(compare);
    const positive = invertTrend
      ? compare.direction === "down"
      : compare.direction === "up" || compare.direction === "new";
    const negative = invertTrend
      ? compare.direction === "up"
      : compare.direction === "down";
    if (compare.direction === "new") changeClass = "text-emerald-600";
    else if (positive) changeClass = "text-emerald-600";
    else if (negative) changeClass = "text-destructive";
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm print:shadow-none",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {changeText ? (
          <span className={cn("font-medium", changeClass)}>
            {changeText}
            {compare?.direction !== "new" ? (
              <span className="font-normal text-muted-foreground"> vs prior</span>
            ) : null}
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
