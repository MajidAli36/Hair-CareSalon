"use client";

import { useActionState, useEffect, useState } from "react";
import { createStaffPayment, type StaffPaymentRow } from "@/lib/actions/payroll";
import { STAFF_PAYMENT_TYPE_LABELS, type StaffPaymentType } from "@/lib/finances/categories";
import { getLocalDateString } from "@/lib/dates/local";
import type { ActionResult } from "@/types/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginatedList } from "@/components/ui/table-pagination";
import { formatCurrency, formatDateTime } from "@/lib/format";

type StaffOption = { id: string; full_name: string };

type StaffPaymentFormProps = {
  staff: StaffOption[];
  /** Matches the finances page date filter so new entries appear in the log. */
  defaultDate: string;
  onRecorded?: (recordDate?: string) => void;
};

export function StaffPaymentForm({ staff, defaultDate, onRecorded }: StaffPaymentFormProps) {
  const [state, formAction, pending] = useActionState(createStaffPayment, {} as ActionResult);
  const [paymentType, setPaymentType] = useState<StaffPaymentType>("SALARY");
  const paymentDate = defaultDate || getLocalDateString();
  const now = new Date();
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  useEffect(() => {
    if (state.success) {
      onRecorded?.(state.recordDate);
    }
  }, [state.success, state.recordDate, onRecorded]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay staff</CardTitle>
        <CardDescription>
          Record salary, partial payments, advances, or bonuses — with date &amp; time for your records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff_id">Staff member *</Label>
              <select
                id="staff_id"
                name="staff_id"
                required
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">Select…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_type">Payment type *</Label>
              <select
                id="payment_type"
                name="payment_type"
                required
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as StaffPaymentType)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {(Object.keys(STAFF_PAYMENT_TYPE_LABELS) as StaffPaymentType[]).map((t) => (
                  <option key={t} value={t}>
                    {STAFF_PAYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount paid (Rs) *</Label>
              <Input id="amount" name="amount" type="number" min={1} step={1} required />
            </div>
            {paymentType === "PARTIAL" && (
              <div className="space-y-2">
                <Label htmlFor="amount_due">Total salary due (Rs)</Label>
                <Input id="amount_due" name="amount_due" type="number" min={1} step={1} placeholder="Full amount owed" />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment date *</Label>
              <Input
                id="payment_date"
                name="payment_date"
                type="date"
                required
                key={paymentDate}
                defaultValue={paymentDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_at">Date &amp; time recorded</Label>
              <Input id="paid_at" name="paid_at" type="datetime-local" defaultValue={localDatetime} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period_start">Period from (optional)</Label>
              <Input id="period_start" name="period_start" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Period to (optional)</Label>
              <Input id="period_end" name="period_end" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Paid via</Label>
            <select
              id="payment_method"
              name="payment_method"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              defaultValue="CASH"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card / Bank</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="e.g. March salary — partial, balance next week" />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">Payment recorded.</p>}
          <Button type="submit" disabled={pending || !staff.length}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function StaffPaymentsLog({
  payments,
  from,
  to,
}: {
  payments: StaffPaymentRow[];
  from: string;
  to: string;
}) {
  return (
    <PaginatedList
      items={payments}
      empty={
        <p className="text-sm text-muted-foreground">
          No staff payments for {from === to ? from : `${from} → ${to}`}. Try &quot;This week&quot;
          or widen the date range above.
        </p>
      }
    >
      {(slice) => (
        <div className="space-y-2">
          {slice.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-muted/20 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{p.staff_name}</p>
                <p className="text-muted-foreground">
                  {STAFF_PAYMENT_TYPE_LABELS[p.payment_type]} · {p.payment_method} · {p.payment_date}
                </p>
                {p.period_start && p.period_end && (
                  <p className="text-xs text-muted-foreground">
                    Period: {p.period_start} → {p.period_end}
                  </p>
                )}
                {p.payment_type === "PARTIAL" && p.amount_due != null && (
                  <p className="text-xs text-amber-700">
                    Paid {formatCurrency(p.amount)} of {formatCurrency(p.amount_due)} due
                    {p.amount_due > p.amount &&
                      ` · Balance ${formatCurrency(p.amount_due - p.amount)}`}
                  </p>
                )}
                {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Logged {formatDateTime(p.paid_at)}
                </p>
              </div>
              <span className="font-semibold text-orange-700">−{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </PaginatedList>
  );
}
