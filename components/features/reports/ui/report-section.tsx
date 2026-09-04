"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ReportSection({
  title,
  description,
  defaultOpen = false,
  actions,
  children,
  className,
}: ReportSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card shadow-sm print:shadow-none",
        className
      )}
    >
      <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left print:pointer-events-none"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform print:hidden",
              open && "rotate-180"
            )}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </button>
        {actions ? <div className="shrink-0 print:hidden">{actions}</div> : null}
      </div>
      {open ? <div className="p-4 sm:p-5">{children}</div> : null}
    </section>
  );
}
