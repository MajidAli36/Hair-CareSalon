"use client";

import { useState } from "react";
import { ReceivePaymentDialog } from "@/components/features/sales/receive-payment-dialog";
import { Button } from "@/components/ui/button";
import { Banknote } from "lucide-react";

export function ReceivePaymentButton({
  saleId,
  amountDue,
  paymentVersion,
  invoiceLabel,
}: {
  saleId: string;
  amountDue: number;
  paymentVersion: number;
  invoiceLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (amountDue <= 0) return null;
  return (
    <>
      <Button variant="default" className="gap-1.5" onClick={() => setOpen(true)}>
        <Banknote className="size-3.5" />
        Receive payment
      </Button>
      <ReceivePaymentDialog
        open={open}
        onOpenChange={setOpen}
        saleId={saleId}
        amountDue={amountDue}
        paymentVersion={paymentVersion}
        invoiceLabel={invoiceLabel}
      />
    </>
  );
}
