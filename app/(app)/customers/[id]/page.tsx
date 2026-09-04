import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getCustomerHistory, updateCustomer } from "@/lib/actions/customers";
import { getCustomerFinancialSummary } from "@/lib/actions/payments";
import { canManageRecords, canUsePos } from "@/lib/auth/permissions";
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
  searchParams: Promise<{ tab?: string }>;
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const showDueOnly = tab === "dues";
  const [customer, history, canManage, canPos, financial] = await Promise.all([
    getCustomer(id),
    getCustomerHistory(id),
    canManageRecords(),
    canUsePos(),
    getCustomerFinancialSummary(id),
  ]);

  if (!customer || !history) notFound();

  const fullName = formatCustomerName(customer.first_name, customer.last_name);
  const boundUpdate = updateCustomer.bind(null, id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-muted-foreground">Customer profile, dues & history</p>
        </div>
        <div className="flex gap-2">
          {customer.phone && (
            <WhatsAppSendButton phone={customer.phone} customerName={fullName} />
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
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Added {formatDate(customer.created_at)}</span>
            <span>Outstanding: {formatCurrency(financial.outstandingDue)}</span>
          </div>
          {customer.notes && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
              {customer.notes}
            </p>
          )}
        </CardContent>
      </Card>

      <CustomerHistoryPanel
        history={history}
        customerId={id}
        financial={financial}
        canReceivePayment={canPos || canManage}
        canViewStatement={canManage}
        showDueOnly={showDueOnly}
      />

      {canManage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Edit customer</CardTitle>
            </CardHeader>
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
