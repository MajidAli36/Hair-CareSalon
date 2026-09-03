"use client";

import { useState, useTransition } from "react";
import { sendWhatsAppMessage } from "@/lib/actions/whatsapp";
import { buildWhatsAppSendUrl } from "@/lib/whatsapp/links";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

type WhatsAppSendButtonProps = {
  phone: string;
  customerId?: string;
  customerName?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
};

export function WhatsAppSendButton({
  phone,
  customerId,
  customerName,
  variant = "outline",
  size = "sm",
}: WhatsAppSendButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openChat() {
    const firstName = customerName?.split(" ")[0];
    const body = firstName
      ? `Hi ${firstName}, this is your salon. `
      : "Hi, this is your salon. ";
    const url = buildWhatsAppSendUrl(phone, body.trim());

    if (!url) {
      setError("Invalid phone number for WhatsApp.");
      return;
    }

    setError(null);
    window.open(url, "_blank", "noopener,noreferrer");

    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("body", body.trim());
    if (customerId) fd.set("customer_id", customerId);

    startTransition(async () => {
      await sendWhatsAppMessage({}, fd);
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} disabled={pending} onClick={openChat}>
        <MessageCircle className="mr-1.5 size-4" />
        {pending ? "Opening…" : "WhatsApp"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
