"use client";

import { useTransition } from "react";
import { cancelOnlineAppointment } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";

type CancelOnlineButtonProps = {
  appointmentId: string;
  onCancelled?: (appointmentId: string) => void;
};

export function CancelOnlineButton({ appointmentId, onCancelled }: CancelOnlineButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm("Cancel this online booking? The slot will become available again.")) return;
        startTransition(async () => {
          const result = await cancelOnlineAppointment(appointmentId);
          if (!result.error) {
            onCancelled?.(appointmentId);
          }
        });
      }}
    >
      {pending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
