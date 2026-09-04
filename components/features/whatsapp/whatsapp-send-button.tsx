"use client";

import { useState } from "react";
import { buildWhatsAppSendUrl } from "@/lib/whatsapp/links";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

type WhatsAppSendButtonProps = {
  phone: string;
  customerName?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
};

export function WhatsAppSendButton({
  phone,
  customerName,
  variant = "outline",
  size = "sm",
}: WhatsAppSendButtonProps) {
  const [error, setError] = useState<string | null>(null);

  function openChat() {
    const firstName = customerName?.split(" ")[0];
    const body = firstName
      ? `Hi ${firstName}, this is Hair & Care Salon.`
      : "Hi, this is Hair & Care Salon.";
    const url = buildWhatsAppSendUrl(phone, body);

    if (!url) {
      setError("Invalid phone number for WhatsApp.");
      return;
    }

    setError(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} onClick={openChat}>
        <MessageCircle className="mr-1.5 size-4" />
        Send WhatsApp
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
