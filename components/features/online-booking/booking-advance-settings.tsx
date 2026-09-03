"use client";

import { useActionState } from "react";
import { saveBookingAdvanceSettings } from "@/lib/actions/appointments";
import type { ActionResult } from "@/types/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  settings: {
    booking_advance_amount: number;
    booking_advance_percent: number;
    booking_payment_instructions: string | null;
  } | null;
};

export function BookingAdvanceSettings({ settings }: Props) {
  const [state, formAction, pending] = useActionState(saveBookingAdvanceSettings, {} as ActionResult);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Online advance payment</CardTitle>
        <CardDescription>
          Set how much customers must pay in advance when booking online. Admin approves payment
          before the appointment is confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="booking_advance_amount">Fixed advance (Rs)</Label>
            <Input
              id="booking_advance_amount"
              name="booking_advance_amount"
              type="number"
              min={0}
              step={1}
              defaultValue={settings?.booking_advance_amount ?? 0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking_advance_percent">Or % of services</Label>
            <Input
              id="booking_advance_percent"
              name="booking_advance_percent"
              type="number"
              min={0}
              max={100}
              defaultValue={settings?.booking_advance_percent ?? 0}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="booking_payment_instructions">Payment instructions (shown to customers)</Label>
            <Textarea
              id="booking_payment_instructions"
              name="booking_payment_instructions"
              rows={3}
              placeholder="Send advance to JazzCash 03XX-XXXXXXX. Include your name in the payment note."
              defaultValue={settings?.booking_payment_instructions ?? ""}
            />
          </div>
          {state.error && <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>}
          {state.success && (
            <p className="sm:col-span-2 text-sm text-green-600">Settings saved.</p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save advance settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
