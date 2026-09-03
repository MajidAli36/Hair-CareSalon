import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconClassName?: string;
};

export function StatCard({
  label,
  value,
  subtext,
  change,
  changeType = "neutral",
  icon: Icon,
  iconClassName,
}: StatCardProps) {
  return (
    <div className="dashboard-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {value}
            </p>
            {(change || subtext) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {change ? (
                  <span
                    className={cn(
                      "font-medium",
                      changeType === "positive" && "text-[#16a34a]",
                      changeType === "negative" && "text-destructive",
                      changeType === "neutral" && "text-muted-foreground"
                    )}
                  >
                    {change}
                  </span>
                ) : null}
                {subtext ? (
                  <span className="text-muted-foreground">{subtext}</span>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80",
            iconClassName
          )}
        >
          <Icon className="size-[18px] text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
