"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { recordManualAppointmentPayment } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/commerce";

export function ManualPaymentForm({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const bound = recordManualAppointmentPayment.bind(null, appointmentId);
  const [state, formAction, pending] = useActionState(bound, {} as ActionResult);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <div className="rounded-lg border border-dashed p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Record advance (one-time)</p>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" min={1} required className="w-28" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Method</Label>
          <select id="method" name="method" className="flex h-8 rounded-lg border border-input bg-background px-2.5 text-sm">
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "…" : "Record advance"}</Button>
        {state.success && <span className="text-sm text-green-600">Advance recorded</span>}
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </form>
    </div>
  );
}
