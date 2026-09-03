import Link from "next/link";
import { notFound } from "next/navigation";
import { getSale } from "@/lib/actions/sales";
import { canManageRecords } from "@/lib/auth/permissions";
import { VoidSaleButton } from "@/components/features/sales/void-sale-button";
import { PrintReceiptButton } from "@/components/features/sales/print-receipt-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCustomerName, formatDateTime } from "@/lib/format";

type SaleDetailPageProps = { params: Promise<{ id: string }> };

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const { id } = await params;
  const [sale, canManage] = await Promise.all([getSale(id), canManageRecords()]);
  if (!sale) notFound();

  const customer = sale.customer as {
    first_name: string; last_name: string | null; phone: string | null; email: string | null;
  } | null;
  const items = (sale.items ?? []) as {
    id: string; name: string; item_type: string; quantity: number; unit_price: number; line_total: number;
  }[];
  const invoice = sale.invoice as { invoice_number: string; issued_at: string }[] | { invoice_number: string; issued_at: string } | null;
  const invoiceData = Array.isArray(invoice) ? invoice[0] : invoice;
  const payments = (sale.payments ?? []) as { method: string; amount: number; paid_at: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invoiceData?.invoice_number ?? "Sale"}
          </h1>
          <p className="text-muted-foreground">Sale details and invoice</p>
        </div>
        <Button variant="outline" render={<Link href="/sales" />}>Back</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Summary</CardTitle>
            <Badge variant={sale.status === "COMPLETED" ? "default" : "secondary"}>{sale.status}</Badge>
          </div>
          <CardDescription>
            {sale.completed_at && `Completed ${formatDateTime(sale.completed_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {customer && (
            <p>
              <span className="text-muted-foreground">Customer:</span>{" "}
              {formatCustomerName(customer.first_name, customer.last_name)}
              {customer.phone && ` · ${customer.phone}`}
            </p>
          )}
          <p><span className="text-muted-foreground">Subtotal:</span> {formatCurrency(sale.subtotal)}</p>
          {Number(sale.discount) > 0 && (
            <p><span className="text-muted-foreground">Discount:</span> -{formatCurrency(sale.discount)}</p>
          )}
          {Number(sale.tax ?? 0) > 0 && (
            <p><span className="text-muted-foreground">Tax:</span> +{formatCurrency(sale.tax ?? 0)}</p>
          )}
          <p className="text-lg font-semibold">Total: {formatCurrency(sale.total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
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
                  <TableCell><Badge variant="secondary">{item.item_type}</Badge></TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p, i) => (
              <p key={i} className="text-sm">
                {p.method}: {formatCurrency(p.amount)} · {formatDateTime(p.paid_at)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <PrintReceiptButton saleId={sale.id} />
        {canManage && sale.status === "COMPLETED" && (
          <VoidSaleButton saleId={sale.id} />
        )}
      </div>
    </div>
  );
}
