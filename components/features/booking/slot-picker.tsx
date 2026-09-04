"use client";

import { useEffect, useState, useTransition } from "react";
import { getAvailableSlots } from "@/lib/actions/scheduling";
import type { BookableSlot } from "@/lib/booking/availability";
import { Label } from "@/components/ui/label";

type SlotPickerProps = {
  date: string;
  staffId?: string;
  serviceIds: string[];
  durationMinutes?: number;
  namePrefix?: string;
  required?: boolean;
  onSlotChange?: (slot: BookableSlot | null) => void;
};

export function SlotPicker({
  date,
  staffId,
  serviceIds,
  durationMinutes,
  namePrefix = "",
  required = true,
  onSlotChange,
}: SlotPickerProps) {
  const canFetch = Boolean(date);
  const serviceKey = serviceIds.join(",");
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!canFetch) return;
    startTransition(async () => {
      const result = await getAvailableSlots({
        date,
        staffId: staffId || undefined,
        serviceIds,
        durationMinutes,
      });
      setSlots(result);
      setSelected("");
      onSlotChange?.(null);
    });
  }, [date, staffId, serviceKey, durationMinutes, canFetch, onSlotChange, serviceIds]);

  const visibleSlots = canFetch ? slots : [];

  const isoName = `${namePrefix}slot_iso`;
  const staffName = `${namePrefix}slot_staff_id`;

  return (
    <div className="space-y-2">
      <Label htmlFor={`${namePrefix}slot`}>Available time *</Label>
      <select
        id={`${namePrefix}slot`}
        name={`${namePrefix}slot_select`}
        required={required}
        value={selected}
        disabled={pending || visibleSlots.length === 0}
        onChange={(e) => {
          const value = e.target.value;
          setSelected(value);
          const slot = visibleSlots.find((s) => s.iso === value) ?? null;
          onSlotChange?.(slot);
        }}
        className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
      >
        <option value="">{pending ? "Loading slots…" : "Select time slot…"}</option>
        {visibleSlots.map((s) => (
          <option key={`${s.iso}-${s.staffId}`} value={s.iso}>
            {s.label}
            {staffId ? "" : ` — ${s.staffName}`}
          </option>
        ))}
      </select>
      <input type="hidden" name={isoName} value={selected} />
      <input
        type="hidden"
        name={staffName}
        value={visibleSlots.find((s) => s.iso === selected)?.staffId ?? ""}
      />
      {!pending && visibleSlots.length === 0 && date && (
        <p className="text-xs text-muted-foreground">
          No open slots for this date. Try another day, staff member, or shorter service list.
        </p>
      )}
    </div>
  );
}
