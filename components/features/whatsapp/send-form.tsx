"use client";

import { useMemo, useState } from "react";
import type { WhatsAppCustomer } from "@/lib/actions/whatsapp";
import { buildWhatsAppSendUrl } from "@/lib/whatsapp/links";
import { buildCustomerThanksMessage } from "@/lib/whatsapp/thanks-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function customerName(customer: WhatsAppCustomer) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ");
}

export function SendWhatsAppForm({ customers }: { customers: WhatsAppCustomer[] }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customerId, customers]
  );
  const [error, setError] = useState<string | null>(null);

  const message = useMemo(
    () =>
      buildCustomerThanksMessage({
        firstName: selectedCustomer?.first_name,
        fullName: selectedCustomer ? customerName(selectedCustomer) : null,
      }),
    [selectedCustomer]
  );

  function selectCustomer(id: string) {
    setCustomerId(id);
    setError(null);
  }

  function openWhatsApp() {
    const url = selectedCustomer
      ? buildWhatsAppSendUrl(selectedCustomer.phone, message)
      : null;
    if (!url) {
      setError("Select a customer with a valid phone number.");
      return;
    }

    setError(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (customers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No customers with phone numbers found. Add a customer phone number first.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="wa_customer">Customer</Label>
        <select
          id="wa_customer"
          value={customerId}
          onChange={(event) => selectCustomer(event.target.value)}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customerName(customer)} — {customer.phone}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-muted/40 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Customer:</span>{" "}
          <strong>{selectedCustomer ? customerName(selectedCustomer) : "—"}</strong>
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Phone:</span>{" "}
          <strong>{selectedCustomer?.phone ?? "—"}</strong>
        </p>
      </div>

      <div className="space-y-2">
        <Label>Message preview</Label>
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed text-foreground">
          {message}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={openWhatsApp}>
        Send WhatsApp
      </Button>
      <p className="text-xs text-muted-foreground">
        WhatsApp will open with this full thank-you message filled in. Click Send there to deliver
        it.
      </p>
    </div>
  );
}
