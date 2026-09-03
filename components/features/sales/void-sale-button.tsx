"use client";

import { voidSale } from "@/lib/actions/sales";
import { ConfirmAction } from "@/components/ui/confirm-action";

export function VoidSaleButton({ saleId }: { saleId: string }) {
  return (
    <ConfirmAction
      title="Void this sale?"
      description="Voiding reverses inventory for products and marks the sale as void. This should only be used for mistakes."
      confirmLabel="Void sale"
      pendingLabel="Voiding…"
      variant="destructive"
      size="default"
      onConfirm={async () => {
        await voidSale(saleId);
      }}
    >
      Void sale
    </ConfirmAction>
  );
}
