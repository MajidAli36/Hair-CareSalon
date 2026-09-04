"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receiveSalePayment } from "@/lib/actions/payments";
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

type ReceivePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  amountDue: number;
  paymentVersion: number;
  invoiceLabel?: string;
};

export function ReceivePaymentDialog({
  open,
  onOpenChange,
  saleId,
  amountDue,
  paymentVersion,
  invoiceLabel,
}: ReceivePaymentDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(amountDue));
  const [tendered, setTendered] = useState(String(amountDue));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [changeMsg, setChangeMsg] = useState<string | null>(null);

  const payAmt = Number(amount) || 0;
  const tenderAmt = Number(tendered) || 0;
  const change = Math.max(0, tenderAmt - payAmt);
  const remaining = Math.max(0, amountDue - payAmt);

  function reset() {
    setAmount(String(amountDue));
    setTendered(String(amountDue));
    setMethod("CASH");
    setNotes("");
    setError(null);
    setChangeMsg(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive payment{invoiceLabel ? ` · ${invoiceLabel}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding due</span>
              <span className="font-semibold">{formatCurrency(amountDue)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="recv-amt">Payment amount</Label>
            <Input
              id="recv-amt"
              type="number"
              min={0.01}
              step={1}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setTendered(e.target.value);
              }}
            />
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAmount(String(amountDue));
                  setTendered(String(amountDue));
                }}
              >
                Pay full due
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="recv-method">Method</Label>
            <select
              id="recv-method"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          {method === "CASH" ? (
            <div className="space-y-1">
              <Label htmlFor="recv-tender">Tendered</Label>
              <Input
                id="recv-tender"
                type="number"
                min={0}
                step={1}
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
              />
              {change > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Change to return: {formatCurrency(change)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="recv-notes">Notes (optional)</Label>
            <Input
              id="recv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {remaining > 0.009 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              After this payment, {formatCurrency(remaining)} will remain outstanding.
            </p>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              This will fully settle the invoice.
            </p>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {changeMsg ? <p className="text-sm text-muted-foreground">{changeMsg}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || payAmt <= 0}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await receiveSalePayment({
                  saleId,
                  amount: payAmt,
                  method,
                  expectedPaymentVersion: paymentVersion,
                  tenderedAmount: method === "CASH" ? tenderAmt : payAmt,
                  notes: notes || null,
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                if (result.changeGiven && result.changeGiven > 0) {
                  setChangeMsg(`Change given: ${formatCurrency(result.changeGiven)}`);
                }
                onOpenChange(false);
                router.refresh();
              });
            }}
          >
            {pending ? "Saving…" : "Receive payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
