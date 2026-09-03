import { redirect } from "next/navigation";
import { getWhatsAppMessages } from "@/lib/actions/whatsapp";
import { canUseWhatsApp, canManageRecords } from "@/lib/auth/permissions";
import { SendWhatsAppForm } from "@/components/features/whatsapp/send-form";
import { WhatsAppMessagesTable } from "@/components/features/whatsapp/messages-table";
import { WhatsAppLinkPanel } from "@/components/features/whatsapp/whatsapp-link-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WhatsAppPage() {
  const canAccess = await canUseWhatsApp();
  if (!canAccess) redirect("/dashboard");

  const [messages, canManage] = await Promise.all([
    getWhatsAppMessages(),
    canManageRecords(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Link the salon WhatsApp once, then queue messages to customers. Each delivery waits
          10–15 seconds for account safety.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WhatsAppLinkPanel canManage={canManage} />
        <Card>
          <CardHeader>
            <CardTitle>How the 10–15s security works</CardTitle>
            <CardDescription>Protects the linked WhatsApp number</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">1. Queue</strong> — Click Send → message is saved
              as <strong className="text-foreground">PENDING</strong> immediately.
            </p>
            <p>
              <strong className="text-foreground">2. Wait 10–15s</strong> — Background worker picks
              a random gap between 10 and 15 seconds (every message, including the first).
            </p>
            <p>
              <strong className="text-foreground">3. Deliver</strong> — Message sends from the linked
              WhatsApp, then status flips to <strong className="text-foreground">SENT</strong> in
              the log automatically (live refresh).
            </p>
            <p>
              <strong className="text-foreground">Extra caps</strong> — Max 180/hour, 800/day, 60s
              cooldown for the same phone, max 500 in queue. Use Pause queue anytime.
            </p>
            <p className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-950">
              Keep this server running while the queue works. Leave at least 10–15s between
              deliveries — do not bypass or spam.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send to customer</CardTitle>
          <CardDescription>
            Queues with a mandatory 10–15s gap when WhatsApp is linked. Opens WhatsApp manually if
            not linked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendWhatsAppForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message log</CardTitle>
          <CardDescription>
            Status updates live — PENDING becomes SENT after the safety gap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsAppMessagesTable messages={messages} />
        </CardContent>
      </Card>
    </div>
  );
}
