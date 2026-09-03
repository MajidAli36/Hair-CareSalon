"use client";

import { formatCurrency } from "@/lib/format";
import {
  calculateRequiredAdvance,
  getAdvanceState,
  sumServicePrices,
  type DepositLine,
} from "@/lib/booking/pricing";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ServiceLine = { service_name?: string; name?: string; price: number; duration_minutes?: number };

type Props = {
  services: ServiceLine[];
  deposits?: DepositLine[];
  advanceSettings?: {
    booking_advance_amount?: number | null;
    booking_advance_percent?: number | null;
  };
  compact?: boolean;
  className?: string;
};

export function AppointmentOrderSummary({
  services,
  deposits = [],
  advanceSettings,
  compact = false,
  className,
}: Props) {
  const serviceTotal = sumServicePrices(services);
  const state = getAdvanceState(deposits, serviceTotal, advanceSettings);

  if (services.length === 0 && serviceTotal === 0 && deposits.length === 0 && state.required === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/30",
        compact ? "p-3 text-sm" : "p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("font-semibold text-foreground", compact ? "text-xs uppercase tracking-wide" : "text-sm")}>
          Order summary
        </p>
        {state.isComplete && (
          <Badge className="bg-green-600 text-[10px]">Advance complete</Badge>
        )}
        {state.hasPending && (
          <Badge className="bg-amber-600 text-[10px]">Awaiting approval</Badge>
        )}
      </div>

      {services.length > 0 && (
        <ul className={cn("space-y-1.5", compact ? "mt-2" : "mt-3")}>
          {services.map((s, i) => (
            <li key={i} className="flex justify-between gap-2 text-muted-foreground">
              <span className="truncate">
                {s.service_name ?? s.name}
                {s.duration_minutes ? ` · ${s.duration_minutes}m` : ""}
              </span>
              <span className="shrink-0 font-medium text-foreground">{formatCurrency(s.price)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={cn("space-y-1.5 border-t border-border", compact ? "mt-2 pt-2" : "mt-3 pt-3")}>
        <div className="flex justify-between font-medium">
          <span>Services total</span>
          <span>{formatCurrency(serviceTotal)}</span>
        </div>

        {state.required > 0 && !state.isComplete && (
          <div className="flex justify-between text-amber-700">
            <span>Advance required (customer)</span>
            <span>{formatCurrency(state.required)}</span>
          </div>
        )}

        {state.approved > 0 && (
          <div className="flex justify-between text-primary">
            <span>Advance paid (approved)</span>
            <span>−{formatCurrency(state.approved)}</span>
          </div>
        )}

        {state.pending > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Advance pending approval</span>
            <span>{formatCurrency(state.pending)}</span>
          </div>
        )}

        {state.refunded > 0 && (
          <div className="flex justify-between text-muted-foreground line-through">
            <span>Refunded</span>
            <span>{formatCurrency(state.refunded)}</span>
          </div>
        )}

        {state.applied > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Advance used at POS</span>
            <span>{formatCurrency(state.applied)}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Balance at salon</span>
          <span>{formatCurrency(state.balanceDue)}</span>
        </div>
      </div>
    </div>
  );
}

export function useBookingTotals(
  selectedServices: { price: number }[],
  advanceSettings?: { booking_advance_amount?: number | null; booking_advance_percent?: number | null }
) {
  const serviceTotal = sumServicePrices(selectedServices);
  const requiredAdvance = advanceSettings
    ? calculateRequiredAdvance(serviceTotal, advanceSettings)
    : 0;
  const balanceDue = Math.max(0, serviceTotal - requiredAdvance);
  return { serviceTotal, requiredAdvance, balanceDue };
}
