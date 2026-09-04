"use client";

import { cn } from "@/lib/utils";

export function ReportEmpty({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {message}
    </div>
  );
}

export function ReportUnavailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
      Unavailable — {reason}
    </div>
  );
}

export function ReportLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[160px] items-center justify-center rounded-lg border border-border/60 bg-muted/10 text-sm text-muted-foreground",
        className
      )}
    >
      Loading report…
    </div>
  );
}

export function ReportError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
