"use client";

import { approveAppointmentDeposit, rejectAppointmentDeposit } from "@/lib/actions/appointments";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { formatCurrency } from "@/lib/format";

type DepositApprovalProps = {
  depositId: string;
  appointmentId?: string;
  amount: number;
  method?: string;
  paymentReference?: string | null;
  notes?: string | null;
  status: string;
  onResolved?: (
    appointmentId: string,
    depositId: string,
    status: "APPROVED" | "REJECTED"
  ) => void;
};

export function DepositApprovalActions({
  depositId,
  appointmentId,
  amount,
  method,
  paymentReference,
  notes,
  status,
  onResolved,
}: DepositApprovalProps) {
  if (status === "APPROVED") {
    return (
      <Badge variant="default" className="bg-green-600">
        Approved {formatCurrency(amount)}
      </Badge>
    );
  }

  if (status === "REJECTED") {
    return <Badge variant="destructive">Rejected</Badge>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground">
          {formatCurrency(amount)} via {method ?? "OTHER"}
        </p>
        {paymentReference && <p>Ref: {paymentReference}</p>}
        {notes && <p>{notes}</p>}
      </div>
      <div className="flex gap-2">
        <ConfirmAction
          title="Approve advance?"
          description={`Approve ${formatCurrency(amount)} advance payment? The booking will be confirmed.`}
          confirmLabel="Approve"
          pendingLabel="Approving…"
          variant="default"
          onConfirm={async () => {
            const result = await approveAppointmentDeposit(depositId);
            if (!result.error && appointmentId) {
              onResolved?.(appointmentId, depositId, "APPROVED");
            }
          }}
        >
          Approve
        </ConfirmAction>
        <ConfirmAction
          title="Reject advance?"
          description="Reject this advance payment? The booking may be cancelled."
          confirmLabel="Reject"
          pendingLabel="Rejecting…"
          variant="outline"
          onConfirm={async () => {
            const result = await rejectAppointmentDeposit(depositId);
            if (!result.error && appointmentId) {
              onResolved?.(appointmentId, depositId, "REJECTED");
            }
          }}
        >
          Reject
        </ConfirmAction>
      </div>
    </div>
  );
}
