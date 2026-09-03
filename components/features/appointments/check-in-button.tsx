"use client";

import { useTransition } from "react";
import { checkInAppointment } from "@/lib/actions/appointments";
import { getTokenReceiptHtml } from "@/lib/actions/print";
import { printThermalHtml } from "@/lib/print/browser";
import { Button } from "@/components/ui/button";

type CheckInButtonProps = {
  appointmentId: string;
  customerName?: string;
  customerPhone?: string | null;
};

export function CheckInButton({
  appointmentId,
  customerName,
  customerPhone,
}: CheckInButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await checkInAppointment(appointmentId);
          if (result.tokenNumber) {
            const html = await getTokenReceiptHtml({
              tokenNumber: result.tokenNumber,
              customerName: customerName ?? "Customer",
              customerPhone,
            });
            printThermalHtml(html);
          } else if (result.error) {
            alert(result.error);
          }
        })
      }
    >
      {pending ? "…" : "Check in + Token"}
    </Button>
  );
}
