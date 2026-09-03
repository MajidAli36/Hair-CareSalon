"use client";

import { useActionState } from "react";
import QRCode from "react-qr-code";
import { updateWhatsAppPhone } from "@/lib/actions/whatsapp";
import type { WhatsAppConfig } from "@/lib/actions/whatsapp";
import { formatWhatsAppDisplay } from "@/lib/whatsapp/links";
import type { ActionResult } from "@/types/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type WhatsAppQrPanelProps = {
  config: WhatsAppConfig;
  canManage: boolean;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      Copy {label}
    </Button>
  );
}

export function WhatsAppQrPanel({ config, canManage }: WhatsAppQrPanelProps) {
  const [state, formAction, pending] = useActionState(updateWhatsAppPhone, {} as ActionResult);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Customer QR codes</CardTitle>
          <CardDescription>
            Customers scan to chat on WhatsApp or book online. Works with your personal or business
            WhatsApp — no Meta API needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!config.whatsappPhone ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Add your salon WhatsApp number to generate chat QR codes.
              </p>
            </div>
          ) : !config.phoneValid ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6 text-center">
              <p className="text-sm text-amber-900">
                Number saved but format looks invalid for WhatsApp. Update to +923001234567 or
                03001234567.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{config.whatsappPhone}</p>
            </div>
          ) : (
            <Tabs defaultValue="whatsapp">
              <TabsList className="mb-4">
                <TabsTrigger value="whatsapp">WhatsApp chat</TabsTrigger>
                <TabsTrigger value="booking">Online booking</TabsTrigger>
              </TabsList>

              <TabsContent value="whatsapp" className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">Ready</Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatWhatsAppDisplay(config.whatsappPhone)}
                  </span>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <QRCode value={config.chatUrl!} size={200} level="M" />
                </div>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  Customer scans → WhatsApp opens with a pre-filled message to{" "}
                  {config.organizationName}. They tap Send to start the chat.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <a
                    href={config.chatUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <Button type="button" size="sm">
                      Test chat link
                    </Button>
                  </a>
                  <CopyButton text={config.chatUrl!} label="chat link" />
                </div>
              </TabsContent>

              <TabsContent value="booking" className="flex flex-col items-center gap-4">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <QRCode value={config.bookingUrl} size={200} level="M" />
                </div>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  Customer scans → opens your online booking page in the browser.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <a
                    href={config.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <Button type="button" size="sm" variant="outline">
                      Open booking page
                    </Button>
                  </a>
                  <CopyButton text={config.bookingUrl} label="booking link" />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Salon number (customer QR)</CardTitle>
            <CardDescription>
              Optional: the number customers message when they scan the left QR. Linking for
              outbound send is separate — use &quot;Link salon WhatsApp&quot; above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form key={config.whatsappPhone ?? "empty"} action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp_phone">Phone number</Label>
                <Input
                  id="whatsapp_phone"
                  name="whatsapp_phone"
                  type="tel"
                  placeholder="+923001234567 or 03001234567"
                  defaultValue={config.whatsappPhone ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  Pakistan: 03XX… or +92 3XX…. This is the number customers message when they scan
                  the QR.
                </p>
              </div>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
              {state.success && (
                <p className="text-sm text-green-600">Number saved — QR codes updated.</p>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save number"}
              </Button>
            </form>

            <div className="mt-6 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Customer QR only</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Save the salon WhatsApp number above.</li>
                <li>Print or display the chat QR at reception.</li>
                <li>Outbound staff messages use &quot;Link salon WhatsApp&quot; at the top of this page.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
