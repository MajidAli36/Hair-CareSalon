import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getCustomerHistory, updateCustomer } from "@/lib/actions/customers";
import { canManageRecords } from "@/lib/auth/permissions";
import { CustomerForm } from "@/components/features/customers/customer-form";
import { CustomerHistoryPanel } from "@/components/features/customers/customer-history";
import { DeleteCustomerButton } from "@/components/features/customers/delete-customer-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WhatsAppSendButton } from "@/components/features/whatsapp/whatsapp-send-button";
import { formatCurrency, formatCustomerName, formatDate } from "@/lib/format";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const [customer, history, canManage] = await Promise.all([
    getCustomer(id),
    getCustomerHistory(id),
    canManageRecords(),
  ]);

  if (!customer || !history) notFound();

  const fullName = formatCustomerName(customer.first_name, customer.last_name);
  const boundUpdate = updateCustomer.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-muted-foreground">Customer profile & full history</p>
        </div>
        <div className="flex gap-2">
          {customer.phone && (
            <WhatsAppSendButton
              phone={customer.phone}
              customerId={id}
              customerName={fullName}
            />
          )}
          <Button variant="outline" size="sm" render={<Link href={`/appointments`} />}>
            Book appointment
          </Button>
          <Button variant="outline" render={<Link href="/customers" />}>
            Back
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact info</CardTitle>
          <CardDescription>
            {customer.phone && <span>{customer.phone}</span>}
            {customer.phone && customer.email && " · "}
            {customer.email && <span>{customer.email}</span>}
            {!customer.phone && !customer.email && "No contact details"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customer.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Added {formatDate(customer.created_at)}</span>
            <span>Lifetime value: {formatCurrency(history.stats.totalSpent)}</span>
          </div>
          {customer.notes && (
            <p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{customer.notes}</p>
          )}
        </CardContent>
      </Card>

      <CustomerHistoryPanel history={history} />

      {canManage && (
        <>
          <Card>
            <CardHeader><CardTitle>Edit customer</CardTitle></CardHeader>
            <CardContent>
              <CustomerForm action={boundUpdate} customer={customer} />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <DeleteCustomerButton customerId={id} customerName={fullName} />
          </div>
        </>
      )}
    </div>
  );
}
