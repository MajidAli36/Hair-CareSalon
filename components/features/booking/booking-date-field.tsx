"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { getLocalDateString, addLocalDays, getLocalHour } from "@/lib/dates/local";
import { cn } from "@/lib/utils";

/** Prefer today; after 6pm Pakistan time, prefer tomorrow (typical salon close). */
export function defaultBookingDate(): string {
  const today = getLocalDateString();
  if (getLocalHour() >= 18) {
    return addLocalDays(today, 1);
  }
  return today;
}

/** Fixed locale + Pakistan calendar noon so SSR and client text always match. */
function formatBookingDate(value: string): string {
  const d = new Date(`${value}T12:00:00+05:00`);
  if (Number.isNaN(d.getTime())) return "Tap to choose a date";
  return d.toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type BookingDateFieldProps = {
  id?: string;
  name?: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  className?: string;
};

export function BookingDateField({
  id = "date",
  name = "date",
  value,
  min,
  max,
  onChange,
  className,
}: BookingDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [labelReady, setLabelReady] = useState(false);

  useEffect(() => {
    setLabelReady(true);
  }, []);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const label = !value
    ? "Tap to choose a date"
    : labelReady
      ? formatBookingDate(value)
      : value; // YYYY-MM-DD until mounted — identical on server + first client paint

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 text-left text-sm text-stone-800 shadow-sm transition-colors hover:border-amber-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-stone-400")}>
          {label}
        </span>
        <CalendarDays className="size-4 shrink-0 text-stone-500" aria-hidden />
      </button>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        required
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden={false}
      />
      <p className="text-xs text-muted-foreground">
        Click the field → pick a day on the calendar → times appear below.
      </p>
    </div>
  );
}
