"use client";

import { useEffect, useState, useTransition } from "react";
import { getPublicAvailableSlots } from "@/lib/actions/scheduling";
import type { BookableSlot } from "@/lib/booking/availability";
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
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!canFetch) return;
    startTransition(async () => {
      const result = await getPublicAvailableSlots(orgSlug, date, staffId, serviceIds);
      setSlots(result);
      setSelected("");
      onSlotChange?.(null);
    });
  }, [orgSlug, date, staffId, serviceKey, canFetch, onSlotChange, serviceIds]);

  const visibleSlots = canFetch ? slots : [];

  return (
    <div className="space-y-2">
      <Label htmlFor="slot" className="text-stone-700">Time slot *</Label>
      <select
        id="slot"
        name="slot_select"
        required
        value={selected}
        disabled={pending || !staffId || visibleSlots.length === 0}
        onChange={(e) => {
          setSelected(e.target.value);
          onSlotChange?.(visibleSlots.find((s) => s.iso === e.target.value) ?? null);
        }}
        className={
          className ??
          "flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        }
      >
        <option value="">{pending ? "Loading…" : "Select time…"}</option>
        {visibleSlots.map((s) => (
          <option key={s.iso} value={s.iso}>
            {s.label}
          </option>
        ))}
      </select>
      <input type="hidden" name="scheduled_at" value={selected} />
      {!pending && staffId && visibleSlots.length === 0 && (
        <p className="text-xs text-muted-foreground">No slots available. Another customer may have booked this time.</p>
      )}
    </div>
  );
}
