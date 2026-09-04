import Link from "next/link";
import { notFound } from "next/navigation";
import { getSale } from "@/lib/actions/sales";
import { getSaleRefunds, getSaleVersions } from "@/lib/actions/sales-lifecycle";
import { canManageRecords, canUsePos } from "@/lib/auth/permissions";
import { isPostedSaleStatus } from "@/lib/sales/lifecycle";
import { VoidSaleButton } from "@/components/features/sales/void-sale-button";
import { PrintReceiptButton } from "@/components/features/sales/print-receipt-button";
import { InvoiceHistoryPanel } from "@/components/features/sales/invoice-history-panel";
import { ReceivePaymentButton } from "@/components/features/sales/receive-payment-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCustomerName, formatDateTime } from "@/lib/format";

type SaleDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function SaleDetailPage({ params, searchParams }: SaleDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [sale, canManage, canPos] = await Promise.all([
    getSale(id),
    canManageRecords(),
    canUsePos(),
  ]);
  if (!sale) notFound();

  const showHistory = tab === "history" && canManage;
  const [versions, refunds] = showHistory
    ? await Promise.all([getSaleVersions(id), getSaleRefunds(id)])
    : [[], []];

  const customer = sale.customer as {
    first_name: string; last_name: string | null; phone: string | null; email: string | null;
  } | null;
  const items = (sale.items ?? []) as {
    id: string; name: string; item_type: string; quantity: number; unit_price: number; line_total: number;
  }[];
  const invoice = sale.invoice as
    | { invoice_number: string; issued_at: string }[]
    | { invoice_number: string; issued_at: string }
    | null;
  const invoiceData = Array.isArray(invoice) ? invoice[0] : invoice;
  const payments = (sale.payments ?? []) as {
    method: string; amount: number; paid_at: string; reference?: string | null;
  }[];
  const saleAny = sale as {
    current_version?: number;
    void_reason?: string | null;
    payment_status?: string;
    amount_paid?: number;
    amount_due?: number;
    amount_refunded?: number;
    payment_version?: number;
    customer_id?: string | null;
  };
  const amountDue = Number(saleAny.amount_due ?? 0);
  const amountPaid = Number(saleAny.amount_paid ?? 0);
  const canReceive =
    (canPos || canManage) && isPostedSaleStatus(sale.status) && amountDue > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invoiceData?.invoice_number ?? "Sale"}
          </h1>
          <p className="text-muted-foreground">
            Sale details and invoice
            {saleAny.current_version && saleAny.current_version > 1
              ? ` · Version ${saleAny.current_version}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReceive ? (
            <ReceivePaymentButton
              saleId={sale.id}
              amountDue={amountDue}
              paymentVersion={Number(saleAny.payment_version ?? 1)}
              invoiceLabel={invoiceData?.invoice_number}
            />
          ) : null}
          {canManage && isPostedSaleStatus(sale.status) ? (
            <Button variant="outline" render={<Link href={`/sales/${id}/edit`} />}>
              Edit
            </Button>
          ) : null}
          {canManage ? (
            <Button
              variant={showHistory ? "default" : "outline"}
              render={<Link href={showHistory ? `/sales/${id}` : `/sales/${id}?tab=history`} />}
            >
              {showHistory ? "Details" : "History"}
            </Button>
          ) : null}
          <Button variant="outline" render={<Link href="/sales" />}>
            Back
          </Button>
        </div>
      </div>

      {showHistory ? (
        <InvoiceHistoryPanel versions={versions ?? []} refunds={refunds ?? []} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Summary</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={isPostedSaleStatus(sale.status) ? "default" : "secondary"}>
                    {sale.status}
                  </Badge>
                  <Badge
                    variant={
                      saleAny.payment_status === "PAID"
                        ? "default"
                        : saleAny.payment_status === "UNPAID"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {(saleAny.payment_status ?? "PAID").replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {sale.completed_at && `Completed ${formatDateTime(sale.completed_at)}`}
                {saleAny.void_reason ? ` · Void: ${saleAny.void_reason}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {customer && (
                <p>
                  <span className="text-muted-foreground">Customer:</span>{" "}
                  {sale.customer_id ? (
                    <Link
                      href={`/customers/${sale.customer_id}`}
                      className="text-primary hover:underline"
                    >
                      {formatCustomerName(customer.first_name, customer.last_name)}
                    </Link>
                  ) : (
                    formatCustomerName(customer.first_name, customer.last_name)
                  )}
                  {customer.phone && ` · ${customer.phone}`}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Subtotal:</span>{" "}
                {formatCurrency(sale.subtotal)}
              </p>
              {Number(sale.discount) > 0 && (
                <p>
                  <span className="text-muted-foreground">Discount:</span> -
                  {formatCurrency(sale.discount)}
                </p>
              )}
              {Number(sale.tax ?? 0) > 0 && (
                <p>
                  <span className="text-muted-foreground">Tax:</span> +
                  {formatCurrency(sale.tax ?? 0)}
                </p>
              )}
              <p className="text-lg font-semibold">
                Invoice total: {formatCurrency(sale.total)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice total</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{formatCurrency(amountPaid)}</span>
              </div>
              {Number(saleAny.amount_refunded ?? 0) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refunded</span>
                  <span>-{formatCurrency(saleAny.amount_refunded ?? 0)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Due</span>
                <span className={amountDue > 0 ? "text-amber-700 dark:text-amber-400" : ""}>
                  {formatCurrency(amountDue)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.item_type}</Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <PrintReceiptButton saleId={sale.id} />
            {canReceive ? (
              <ReceivePaymentButton
                saleId={sale.id}
                amountDue={amountDue}
                paymentVersion={Number(saleAny.payment_version ?? 1)}
                invoiceLabel={invoiceData?.invoice_number}
              />
            ) : null}
            {canManage && isPostedSaleStatus(sale.status) ? (
              <>
                <Button variant="outline" render={<Link href={`/sales/${sale.id}/edit`} />}>
                  Edit / Amend
                </Button>
                <VoidSaleButton saleId={sale.id} />
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
