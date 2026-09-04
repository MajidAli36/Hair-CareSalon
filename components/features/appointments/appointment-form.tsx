"use client";

import { useActionState, useState } from "react";
import { AppointmentOrderSummary } from "@/components/features/appointments/appointment-order-summary";
import { createAppointment } from "@/lib/actions/appointments";
import { SlotPicker } from "@/components/features/booking/slot-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCustomerName } from "@/lib/format";
import { getLocalDateString } from "@/lib/dates/local";
import type { ActionResult } from "@/types/commerce";

type Props = {
  customers: { id: string; first_name: string; last_name: string | null }[];
  staff: { id: string; full_name: string }[];
  services: { id: string; name: string; price: number; duration_minutes: number }[];
};

export function AppointmentForm({ customers, staff, services }: Props) {
  const [state, formAction, pending] = useActionState(createAppointment, {} as ActionResult);
  const [date, setDate] = useState(getLocalDateString);
  const [staffId, setStaffId] = useState("none");
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  const selectedServices = services.filter((s) => serviceIds.includes(s.id));

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="customer_id">Customer *</Label>
        <select
          id="customer_id"
          name="customer_id"
          required
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">Select…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {formatCustomerName(c.first_name, c.last_name)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="staff_id">Staff</Label>
        <select
          id="staff_id"
          name="staff_id"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="none">Any available</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="appt_date">Date *</Label>
        <Input
          id="appt_date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <SlotPicker
          date={date}
          staffId={staffId === "none" ? undefined : staffId}
          serviceIds={serviceIds}
        />
        <p className="text-xs text-muted-foreground">
          Slots are shared with online booking — if a customer books online, that time won&apos;t appear here.
        </p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Services</Label>
        <div className="grid gap-2 sm:grid-cols-2 max-h-40 overflow-y-auto rounded-lg border p-3">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={serviceIds.includes(s.id)}
                onChange={() => toggleService(s.id)}
                className="size-4 rounded border"
              />
              {s.name} ({s.duration_minutes} min)
            </label>
          ))}
        </div>
        {serviceIds.map((id) => (
          <input key={id} type="hidden" name="service_ids" value={id} />
        ))}
      </div>

      {selectedServices.length > 0 && (
        <div className="sm:col-span-2">
          <AppointmentOrderSummary
            services={selectedServices.map((s) => ({
              name: s.name,
              price: s.price,
              duration_minutes: s.duration_minutes,
            }))}
          />
        </div>
      )}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <div className="sm:col-span-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Advance payment (optional)</p>
          <p className="text-xs text-muted-foreground">
            One-time deposit per appointment — applied at POS checkout. Leave blank if no advance now.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="advance_amount">Amount (Rs)</Label>
            <Input id="advance_amount" name="advance_amount" type="number" min={0} step={1} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advance_method">Method</Label>
            <select
              id="advance_method"
              name="advance_method"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              defaultValue="CASH"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="advance_notes">Note</Label>
            <Input id="advance_notes" name="advance_notes" placeholder="Advance at booking" />
          </div>
        </div>
      </div>

      {state.error && <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Booking…" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
