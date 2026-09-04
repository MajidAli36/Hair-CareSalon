"use client";

import { useEffect, useState, useTransition } from "react";
import { getPublicAvailableSlots } from "@/lib/actions/scheduling";
import type { BookableSlot } from "@/lib/booking/availability";
import { getLocalDateString } from "@/lib/dates/local";
import { Label } from "@/components/ui/label";

type PublicSlotPickerProps = {
  orgSlug: string;
  date: string;
  staffId: string;
  serviceIds: string[];
  onSlotChange?: (slot: BookableSlot | null) => void;
  className?: string;
};

export function PublicSlotPicker({
  orgSlug,
  date,
  staffId,
  serviceIds,
  onSlotChange,
  className,
}: PublicSlotPickerProps) {
  const canFetch = Boolean(date && staffId);
  const serviceKey = serviceIds.join(",");
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!canFetch) {
      setSlots([]);
      setSelected("");
      setLoaded(false);
      onSlotChange?.(null);
      return;
    }

    let cancelled = false;
    setLoaded(false);
    startTransition(async () => {
      const result = await getPublicAvailableSlots(orgSlug, date, staffId, serviceIds);
      if (cancelled) return;
      setSlots(result);
      setSelected("");
      setLoaded(true);
      onSlotChange?.(null);
    });

    return () => {
      cancelled = true;
    };
    // serviceKey covers serviceIds; onSlotChange is optional and often unstable
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable deps
  }, [orgSlug, date, staffId, serviceKey, canFetch]);

  const visibleSlots = canFetch ? slots : [];
  const showEmpty =
    canFetch && loaded && !pending && visibleSlots.length === 0;

  let hint: string | null = null;
  if (!staffId) {
    hint = "Select a stylist first.";
  } else if (!date) {
    hint = "Choose a date to see available times.";
  } else if (pending || !loaded) {
    hint = null;
  } else if (showEmpty) {
    const isToday = date === getLocalDateString();
    hint = isToday
      ? "No more times left today. Pick tomorrow or another day."
      : "No open times for this date. Try another day, or ask the salon to set this stylist’s hours.";
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="slot" className="text-stone-700">
        Time slot *
      </Label>
      <select
        id="slot"
        name="slot_select"
        required
        value={selected}
        disabled={pending || !canFetch || visibleSlots.length === 0}
        onChange={(e) => {
          setSelected(e.target.value);
          onSlotChange?.(visibleSlots.find((s) => s.iso === e.target.value) ?? null);
        }}
        className={
          className ??
          "flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        }
      >
        <option value="">
          {pending || (canFetch && !loaded) ? "Loading…" : "Select time…"}
        </option>
        {visibleSlots.map((s) => (
          <option key={s.iso} value={s.iso}>
            {s.label}
          </option>
        ))}
      </select>
      <input type="hidden" name="scheduled_at" value={selected} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
