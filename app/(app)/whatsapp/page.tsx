import { redirect } from "next/navigation";
import { getWhatsAppCustomers } from "@/lib/actions/whatsapp";
import { canUseWhatsApp } from "@/lib/auth/permissions";
import { SendWhatsAppForm } from "@/components/features/whatsapp/send-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WhatsAppPage() {
  const canAccess = await canUseWhatsApp();
  if (!canAccess) redirect("/dashboard");

  const customers = await getWhatsAppCustomers();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Select a customer and open WhatsApp with a pre-written message.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send to customer</CardTitle>
          <CardDescription>
            WhatsApp opens with the message already written. Review it, then click Send in
            WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendWhatsAppForm customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
