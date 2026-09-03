"use client";

import { useActionState, useEffect, useState } from "react";
import { sendWhatsAppMessage } from "@/lib/actions/whatsapp";
import { buildWhatsAppSendUrl } from "@/lib/whatsapp/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/types/commerce";

const TEMPLATES = [
  {
    label: "Appointment confirmed",
    body: "Hi! Your appointment at our salon is confirmed. We look forward to seeing you. Reply here if you need to reschedule.",
  },
  {
    label: "Reminder",
    body: "Hi! This is a friendly reminder about your upcoming salon appointment. Please arrive 5 minutes early. See you soon!",
  },
  {
    label: "Thank you",
    body: "Thank you for visiting us today! We hope you loved your service. Book your next visit anytime — we'd love to see you again.",
  },
  {
    label: "Booking link",
    body: "Hi! You can book your next appointment online on our website. Let us know if you need any help choosing a service or stylist.",
  },
] as const;

export function SendWhatsAppForm() {
  const [state, formAction, pending] = useActionState(sendWhatsAppMessage, {} as ActionResult);
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (state.success && state.sentVia === "wa_me" && state.waUrl) {
      window.open(state.waUrl, "_blank", "noopener,noreferrer");
    }
  }, [state.success, state.sentVia, state.waUrl]);

  function applyTemplate(text: string) {
    setBody(text);
    setPreviewError(null);
  }

  function handlePreview() {
    const url = buildWhatsAppSendUrl(phone, body);
    if (!url) {
      setPreviewError("Enter a valid phone and message first.");
      return;
    }
    setPreviewError(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label>Quick templates</Label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button
              key={t.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyTemplate(t.body)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa_phone">Customer phone *</Label>
        <Input
          id="wa_phone"
          name="phone"
          type="tel"
          placeholder="+923001234567 or 03001234567"
          required
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setPreviewError(null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Linked mode: each send waits a random <strong>10–15 seconds</strong> before delivery
          (account safety). Status in the log updates when it sends.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa_body">Message *</Label>
        <Textarea
          id="wa_body"
          name="body"
          rows={4}
          required
          placeholder="Your appointment is confirmed…"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setPreviewError(null);
          }}
        />
      </div>

      {(state.error || previewError) && (
        <p className="text-sm text-destructive">{state.error ?? previewError}</p>
      )}
      {state.success && state.sentVia === "queued" && (
        <p className="text-sm text-green-600">
          Queued
          {state.queuePosition ? ` (#${state.queuePosition})` : ""}. Waiting 10–15s safety gap,
          then status becomes SENT
          {typeof state.estimatedWaitSeconds === "number"
            ? ` · ETA ~${Math.max(state.estimatedWaitSeconds, 10)}s`
            : ""}
          .
        </p>
      )}
      {state.success && state.sentVia === "wa_me" && (
        <p className="text-sm text-green-600">
          WhatsApp opened — tap Send there. Link salon WhatsApp above for automatic queued send.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Queueing…" : "Send via WhatsApp"}
        </Button>
        <Button type="button" variant="outline" onClick={handlePreview}>
          Preview only
        </Button>
      </div>
    </form>
  );
}
