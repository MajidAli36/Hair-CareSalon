"use client";

import { useActionState, useCallback, useState } from "react";
import {
  approveAppointmentDeposit,
  rejectAppointmentDeposit,
} from "@/lib/actions/appointments";
import { revertAppointmentDeposit } from "@/lib/actions/deposits";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { DepositLine } from "@/lib/booking/pricing";
import type { ActionResult } from "@/types/commerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DepositManagementProps = {
  appointmentId: string;
  deposits: DepositLine[];
  onUpdated?: (
    appointmentId: string,
    depositId: string,
    status: "APPROVED" | "REJECTED" | "REFUNDED"
  ) => void;
};

export function DepositManagement({
  appointmentId,
  deposits,
  onUpdated,
}: DepositManagementProps) {
  if (!deposits.length) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Advance payments
      </p>
      {deposits.map((deposit) => (
        <DepositRow
          key={deposit.id}
          appointmentId={appointmentId}
          deposit={deposit}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

function DepositRow({
  appointmentId,
  deposit,
  onUpdated,
}: {
  appointmentId: string;
  deposit: DepositLine;
  onUpdated?: DepositManagementProps["onUpdated"];
}) {
  if (!deposit.id) return null;

  if (deposit.status === "PENDING") {
    return (
      <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-semibold">{formatCurrency(deposit.amount)}</span>
            <span className="text-muted-foreground"> · awaiting approval</span>
          </div>
          <Badge className="bg-amber-600">Pending</Badge>
        </div>
        {deposit.payment_reference && (
          <p className="text-xs text-muted-foreground">Ref: {deposit.payment_reference}</p>
        )}
        {deposit.notes && <p className="text-xs text-muted-foreground">{deposit.notes}</p>}
        <div className="flex gap-2">
          <ConfirmAction
            title="Approve advance?"
            description={`Approve ${formatCurrency(deposit.amount)}? The booking will be confirmed.`}
            confirmLabel="Approve"
            pendingLabel="Approving…"
            variant="default"
            onConfirm={async () => {
              const result = await approveAppointmentDeposit(deposit.id!);
              if (!result.error) onUpdated?.(appointmentId, deposit.id!, "APPROVED");
            }}
          >
            Approve
          </ConfirmAction>
          <ConfirmAction
            title="Reject advance?"
            description="Reject this advance? The booking will be cancelled."
            confirmLabel="Reject"
            pendingLabel="Rejecting…"
            variant="outline"
            onConfirm={async () => {
              const result = await rejectAppointmentDeposit(deposit.id!);
              if (!result.error) onUpdated?.(appointmentId, deposit.id!, "REJECTED");
            }}
          >
            Reject
          </ConfirmAction>
        </div>
      </div>
    );
  }

  if (deposit.status === "APPROVED") {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-2.5 text-sm">
        <div>
          <p className="font-semibold text-green-700">
            {formatCurrency(deposit.amount)} approved
          </p>
          {deposit.applied_to_sale_id ? (
            <p className="text-xs text-muted-foreground">Used at POS — cannot revert</p>
          ) : (
            <p className="text-xs text-muted-foreground">Held for checkout</p>
          )}
          {deposit.payment_reference && (
            <p className="text-xs text-muted-foreground">Ref: {deposit.payment_reference}</p>
          )}
        </div>
        {!deposit.applied_to_sale_id && (
          <RefundDepositDialog
            depositId={deposit.id}
            amount={deposit.amount}
            onRefunded={() => onUpdated?.(appointmentId, deposit.id!, "REFUNDED")}
          />
        )}
      </div>
    );
  }

  if (deposit.status === "REFUNDED") {
    return (
      <div className="rounded-md border border-dashed p-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium line-through opacity-70">
            {formatCurrency(deposit.amount)}
          </span>
          <Badge variant="secondary">Refunded</Badge>
        </div>
        {deposit.refund_reason && (
          <p className="mt-1 text-xs text-muted-foreground">{deposit.refund_reason}</p>
        )}
        {deposit.refunded_at && (
          <p className="text-[10px] text-muted-foreground">
            {formatDateTime(deposit.refunded_at)}
            {deposit.refund_method ? ` · via ${deposit.refund_method}` : ""}
          </p>
        )}
      </div>
    );
  }

  if (deposit.status === "REJECTED") {
    return (
      <div className="rounded-md border border-dashed p-2.5 text-sm text-muted-foreground">
        <span className="line-through">{formatCurrency(deposit.amount)}</span> rejected
      </div>
    );
  }

  return null;
}

function RefundDepositDialog({
  depositId,
  amount,
  onRefunded,
}: {
  depositId: string;
  amount: number;
  onRefunded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const refundAction = useCallback(
    async (prev: ActionResult, formData: FormData) => {
      const result = await revertAppointmentDeposit(prev, formData);
      if (result.success) {
        setOpen(false);
        onRefunded();
      }
      return result;
    },
    [onRefunded]
  );
  const [state, formAction, isPending] = useActionState(refundAction, {} as ActionResult);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline" className="text-destructive">
            Revert &amp; refund
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revert advance payment</DialogTitle>
          <DialogDescription>
            Return {formatCurrency(amount)} to the customer. This records a refund in finances
            and releases the advance from this appointment.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="depositId" value={depositId} />
          <div className="space-y-2">
            <Label htmlFor={`reason-${depositId}`}>Reason *</Label>
            <Textarea
              id={`reason-${depositId}`}
              name="reason"
              required
              rows={2}
              placeholder="e.g. Customer cancelled, wrong amount, booking rescheduled"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`refundMethod-${depositId}`}>Money returned via *</Label>
            <select
              id={`refundMethod-${depositId}`}
              name="refundMethod"
              required
              className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              defaultValue="CASH"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card / bank transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`refundReference-${depositId}`}>Refund reference (optional)</Label>
            <Input
              id={`refundReference-${depositId}`}
              name="refundReference"
              placeholder="Transaction ID, receipt #"
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" variant="destructive" disabled={isPending} className="w-full">
            {isPending ? "Processing…" : "Confirm refund"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
