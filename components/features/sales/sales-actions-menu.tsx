"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Eye,
  Pencil,
  Printer,
  MoreHorizontal,
  History,
  Ban,
  Undo2,
  Banknote,
} from "lucide-react";
import { printSaleReceipt } from "@/components/features/sales/print-receipt-button";
import { voidSale } from "@/lib/actions/sales";
import { refundSale } from "@/lib/actions/sales-lifecycle";
import { isPostedSaleStatus } from "@/lib/sales/lifecycle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SalesActionsMenuProps = {
  saleId: string;
  status: string;
  total: number;
  amountDue?: number;
  paymentVersion?: number;
  invoiceLabel?: string;
  canManage: boolean;
  canReceivePayment?: boolean;
  onReceivePayment?: () => void;
};

export function SalesActionsMenu({
  saleId,
  status,
  total,
  amountDue = 0,
  canManage,
  canReceivePayment = false,
  onReceivePayment,
}: SalesActionsMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voidOpen, setVoidOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState(String(total));
  const [error, setError] = useState<string | null>(null);

  const posted = isPostedSaleStatus(status);
  const showReceive = canReceivePayment && amountDue > 0 && posted;

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          render={<Link href={`/sales/${saleId}`} />}
        >
          <Eye className="size-3.5" />
          View
        </Button>
        {showReceive && onReceivePayment ? (
          <Button variant="outline" size="sm" className="gap-1" onClick={onReceivePayment}>
            <Banknote className="size-3.5" />
            Pay
          </Button>
        ) : null}
        {canManage && posted ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            render={<Link href={`/sales/${saleId}/edit`} />}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2 text-sm outline-none hover:bg-muted"
            aria-label="More actions"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {showReceive && onReceivePayment ? (
              <DropdownMenuItem onClick={onReceivePayment}>
                <Banknote className="size-3.5" />
                Receive payment
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                void printSaleReceipt(saleId);
              }}
            >
              <Printer className="size-3.5" />
              Print invoice
            </DropdownMenuItem>
            {canManage ? (
              <DropdownMenuItem onClick={() => router.push(`/sales/${saleId}?tab=history`)}>
                <History className="size-3.5" />
                Invoice history
              </DropdownMenuItem>
            ) : null}
            {canManage && posted ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setError(null);
                    setRefundOpen(true);
                  }}
                >
                  <Undo2 className="size-3.5" />
                  Refund
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setError(null);
                    setReason("");
                    setVoidOpen(true);
                  }}
                >
                  <Ban className="size-3.5" />
                  Void invoice
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voiding restores product stock and excludes this sale from revenue. Payments remain as
            history.
          </p>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this invoice being voided?"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await voidSale(saleId, reason);
                  if (res.error) {
                    setError(res.error);
                    return;
                  }
                  setVoidOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Voiding…" : "Void invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Partial or full refund. Full refund restores inventory and marks the sale REFUNDED.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Amount</Label>
              <Input
                id="refund-amount"
                type="number"
                min={0}
                step="1"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <Textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Refund reason"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await refundSale({
                    saleId,
                    amount: Number(refundAmount),
                    method: "CASH",
                    reason,
                  });
                  if (res.error) {
                    setError(res.error);
                    return;
                  }
                  setRefundOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Refunding…" : "Confirm refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
