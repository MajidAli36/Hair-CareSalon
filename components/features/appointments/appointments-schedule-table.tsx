"use client";

import Link from "next/link";
import { AppointmentOrderSummary } from "@/components/features/appointments/appointment-order-summary";
import { CheckInButton } from "@/components/features/appointments/check-in-button";
import { DepositManagement } from "@/components/features/appointments/deposit-management";
import { ManualPaymentForm } from "@/components/features/appointments/manual-payment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginatedList } from "@/components/ui/table-pagination";
import {
  canCollectAdvance,
  getApprovedDepositTotal,
  getPendingDepositTotal,
  sumServicePrices,
  type DepositLine,
} from "@/lib/booking/pricing";
import { formatCurrency, formatCustomerName, formatTime } from "@/lib/format";
import { CancelOnlineButton } from "@/components/features/online-booking/cancel-online-button";

export type AppointmentRow = {
  id: string;
  scheduled_at: string;
  status: string;
  source?: string;
  customer: {
    first_name: string;
    last_name: string | null;
    phone: string | null;
    email?: string | null;
  };
  staff: { full_name: string } | null;
  services: { service_name: string; price: number; duration_minutes: number }[];
  deposits: DepositLine[];
};

type Props = {
  appointments: AppointmentRow[];
  mode: "staff" | "online";
  advanceSettings?: {
    booking_advance_amount?: number | null;
    booking_advance_percent?: number | null;
  };
  emptyMessage?: string;
  emptyAction?: { label: string; href: string };
  onDepositResolved?: (
    appointmentId: string,
    depositId: string,
    status: "APPROVED" | "REJECTED" | "REFUNDED"
  ) => void;
  onAppointmentCancelled?: (appointmentId: string) => void;
  onAppointmentUpdated?: (appointmentId: string, patch: Partial<AppointmentRow>) => void;
};

export function AppointmentsScheduleTable({
  appointments,
  mode,
  advanceSettings,
  emptyMessage = "No appointments on this date.",
  emptyAction,
  onDepositResolved,
  onAppointmentCancelled,
}: Props) {
  return (
    <PaginatedList
      items={appointments}
      empty={
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          {emptyAction && (
            <Button className="mt-4" render={<Link href={emptyAction.href} />}>
              {emptyAction.label}
            </Button>
          )}
        </div>
      }
    >
      {(slice) => (
        <div className="space-y-4">
          {slice.map((a) => {
            const customer = a.customer;
            const staffMember = a.staff;
            const services = a.services ?? [];
            const deposits = a.deposits ?? [];
            const serviceTotal = sumServicePrices(services);
            const approvedAdvance = getApprovedDepositTotal(deposits);
            const pendingAdvance = getPendingDepositTotal(deposits);
            const balanceDue = Math.max(0, serviceTotal - approvedAdvance);
            const settings = mode === "online" ? advanceSettings : undefined;
            const showManualPayment =
              mode === "staff" &&
              canCollectAdvance(deposits, serviceTotal, settings) &&
              !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status);

            return (
              <div
                key={a.id}
                className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">
                        {formatTime(a.scheduled_at)}
                      </span>
                      <Badge variant="outline">{a.status}</Badge>
                      {pendingAdvance > 0 && (
                        <Badge className="bg-amber-600">Advance pending</Badge>
                      )}
                    </div>
                    <p className="font-medium">
                      {formatCustomerName(customer.first_name, customer.last_name)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {customer.phone ?? "—"}
                      {customer.email ? ` · ${customer.email}` : ""}
                      {staffMember ? ` · ${staffMember.full_name}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {mode === "staff" &&
                      ["SCHEDULED", "CONFIRMED"].includes(a.status) && (
                        <CheckInButton
                          appointmentId={a.id}
                          customerName={formatCustomerName(
                            customer.first_name,
                            customer.last_name
                          )}
                          customerPhone={customer.phone}
                        />
                      )}
                    {mode === "online" &&
                      !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status) && (
                        <CancelOnlineButton
                          appointmentId={a.id}
                          onCancelled={onAppointmentCancelled}
                        />
                      )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <AppointmentOrderSummary
                    services={services}
                    deposits={deposits}
                    advanceSettings={settings}
                    compact
                  />

                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">Services</p>
                        <p className="font-semibold">{formatCurrency(serviceTotal)}</p>
                      </div>
                      <div className="rounded-lg bg-primary/5 p-2">
                        <p className="text-xs text-muted-foreground">Advance</p>
                        <p className="font-semibold text-primary">
                          {approvedAdvance > 0
                            ? formatCurrency(approvedAdvance)
                            : pendingAdvance > 0
                              ? `${formatCurrency(pendingAdvance)}*`
                              : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-semibold">{formatCurrency(balanceDue)}</p>
                      </div>
                    </div>

                    {deposits.length > 0 && (
                      <DepositManagement
                        appointmentId={a.id}
                        deposits={deposits}
                        onUpdated={onDepositResolved}
                      />
                    )}

                    {showManualPayment && <ManualPaymentForm appointmentId={a.id} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PaginatedList>
  );
}
