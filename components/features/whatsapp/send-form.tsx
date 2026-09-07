"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import type { WhatsAppCustomer } from "@/lib/actions/whatsapp";
import { buildWhatsAppSendUrl } from "@/lib/whatsapp/links";
import {
  WHATSAPP_TEMPLATES,
  buildWhatsAppTemplateMessage,
  getWhatsAppTemplateMeta,
  type WhatsAppTemplateId,
} from "@/lib/whatsapp/templates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function customerName(customer: WhatsAppCustomer) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ");
}

export function SendWhatsAppForm({ customers }: { customers: WhatsAppCustomer[] }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<WhatsAppTemplateId>("thanks");
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customerId, customers]
  );

  const templateMessage = useMemo(
    () =>
      buildWhatsAppTemplateMessage(templateId, {
        firstName: selectedCustomer?.first_name,
        fullName: selectedCustomer ? customerName(selectedCustomer) : null,
      }),
    [selectedCustomer, templateId]
  );

  const selectedTemplate = getWhatsAppTemplateMeta(templateId);
  const isDirty = message !== templateMessage;

  useEffect(() => {
    setMessage(templateMessage);
    setIsEditing(false);
    setError(null);
  }, [templateMessage]);

  function selectCustomer(id: string) {
    setCustomerId(id);
  }

  function selectTemplate(id: WhatsAppTemplateId) {
    setTemplateId(id);
  }

  function resetMessage() {
    setMessage(templateMessage);
    setIsEditing(false);
    setError(null);
  }

  function openWhatsApp() {
    const body = message.trim();
    if (!body) {
      setError("Message cannot be empty. Edit the text or reset the template.");
      return;
    }

    const url = selectedCustomer
      ? buildWhatsAppSendUrl(selectedCustomer.phone, body)
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

      <div className="space-y-2">
        <Label htmlFor="wa_template">Message template</Label>
        <select
          id="wa_template"
          value={templateId}
          onChange={(event) =>
            selectTemplate(event.target.value as WhatsAppTemplateId)
          }
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        >
          {WHATSAPP_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
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
        <p className="mt-1">
          <span className="text-muted-foreground">Template:</span>{" "}
          <strong>{selectedTemplate.label}</strong>
          {isDirty ? (
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              (edited)
            </span>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="wa_message">
            {isEditing ? "Edit message" : "Message preview"}
          </Label>
          <div className="flex items-center gap-2">
            {isDirty ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetMessage}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            ) : null}
            <Button
              type="button"
              variant={isEditing ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsEditing((value) => !value)}
            >
              <Pencil className="size-3.5" />
              {isEditing ? "Done editing" : "Edit"}
            </Button>
          </div>
        </div>

        {isEditing ? (
          <Textarea
            id="wa_message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setError(null);
            }}
            className="min-h-64 resize-y whitespace-pre-wrap text-sm leading-relaxed"
          />
        ) : (
          <div className="max-h-72 min-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed text-foreground">
            {message}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={openWhatsApp}>
        Send WhatsApp
      </Button>
      <p className="text-xs text-muted-foreground">
        Choose a template, edit the wording if needed, then open WhatsApp. Click Send there to
        deliver the message.
      </p>
    </div>
  );
}
