"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewCustomerAccountPayment,
  receiveCustomerAccountPayment,
} from "@/lib/actions/payments";
import type { PaymentMethod } from "@/types/commerce";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AccountReceivePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  outstandingDue: number;
};

export function AccountReceivePaymentDialog({
  open,
  onOpenChange,
  customerId,
  outstandingDue,
}: AccountReceivePaymentDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(outstandingDue));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewCustomerAccountPayment>
  > | null>(null);

  const payAmt = Number(amount) || 0;

  async function loadPreview() {
    setError(null);
    const p = await previewCustomerAccountPayment(customerId, payAmt);
    if (p.unallocated > 0.009) {
      setError(
        `Payment exceeds outstanding dues by ${formatCurrency(p.unallocated)}. Reduce the amount.`
      );
      setPreview(null);
      return;
    }
    setPreview(p);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPreview(null);
          setError(null);
          setAmount(String(outstandingDue));
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive account payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between rounded-lg border border-border bg-muted/30 p-3">
            <span className="text-muted-foreground">Outstanding</span>
            <span className="font-semibold">{formatCurrency(outstandingDue)}</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="acct-amt">Payment amount</Label>
            <Input
              id="acct-amt"
              type="number"
              min={0.01}
              step={1}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPreview(null);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acct-method">Method</Label>
            <select
              id="acct-method"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="acct-notes">Notes</Label>
            <Input id="acct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>
            Preview allocation
          </Button>
          {preview ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="font-medium">Allocation (confirm before saving)</p>
              {preview.allocations.map((a) => (
                <div key={a.saleId} className="flex justify-between text-xs">
                  <span>
                    {a.invoiceNumber ?? a.saleId.slice(0, 8)} · due was{" "}
                    {formatCurrency(a.previousDue)}
                  </span>
                  <span>
                    −{formatCurrency(a.amount)} → {formatCurrency(a.remainingDue)}
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Remaining customer due after:{" "}
                {formatCurrency(Math.max(0, preview.outstanding - preview.applied))}
              </p>
            </div>
          ) : null}
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !preview?.allocations.length}
            onClick={() => {
              if (!preview) return;
              setError(null);
              startTransition(async () => {
                const result = await receiveCustomerAccountPayment({
                  customerId,
                  amount: preview.applied,
                  method,
                  notes: notes || null,
                  allocations: preview.allocations.map((a) => ({
                    saleId: a.saleId,
                    amount: a.amount,
                    expectedPaymentVersion: a.expectedPaymentVersion,
                  })),
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                onOpenChange(false);
                router.refresh();
              });
            }}
          >
            {pending ? "Saving…" : "Confirm payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
