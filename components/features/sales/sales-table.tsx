"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesActionsMenu } from "@/components/features/sales/sales-actions-menu";
import { ReceivePaymentDialog } from "@/components/features/sales/receive-payment-dialog";
import { formatCurrency, formatCustomerName, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 10;

type SaleRow = {
  id: string;
  total: number;
  status: string;
  payment_status?: string;
  amount_paid?: number;
  amount_due?: number;
  payment_version?: number;
  completed_at: string | null;
  created_at: string;
  customer: { first_name: string; last_name: string | null } | null;
  invoice: { invoice_number: string }[] | { invoice_number: string } | null;
};

function paymentBadgeVariant(status?: string) {
  if (status === "PAID") return "default" as const;
  if (status === "PARTIALLY_PAID" || status === "PARTIALLY_REFUNDED") return "secondary" as const;
  if (status === "UNPAID") return "destructive" as const;
  return "outline" as const;
}

export function SalesTable({
  sales,
  canManage = false,
  canReceivePayment = false,
  emptyLabel,
}: {
  sales: SaleRow[];
  canManage?: boolean;
  canReceivePayment?: boolean;
  emptyLabel?: string;
}) {
  const { page, setPage, slice } = usePagination(sales, PAGE_SIZE);
  const [paySale, setPaySale] = useState<SaleRow | null>(null);

  if (sales.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? "No sales yet. Start from POS."}
      </p>
    );
  }

  return (
    <div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Sale</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[240px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((sale) => {
              const invoice = sale.invoice;
              const invoiceNum = Array.isArray(invoice)
                ? invoice[0]?.invoice_number
                : invoice?.invoice_number;
              const when = sale.completed_at ?? sale.created_at;
              const due = Number(sale.amount_due ?? 0);
              const paid = Number(sale.amount_paid ?? 0);
              const canPay =
                canReceivePayment &&
                due > 0 &&
                (sale.status === "COMPLETED" || sale.status === "AMENDED");
              return (
                <TableRow key={sale.id} className="group">
                  <TableCell className="font-medium">{invoiceNum ?? "—"}</TableCell>
                  <TableCell>
                    {sale.customer
                      ? formatCustomerName(sale.customer.first_name, sale.customer.last_name)
                      : "Walk-in"}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(paid)}</TableCell>
                  <TableCell className="text-right">
                    {due > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {formatCurrency(due)}
                      </span>
                    ) : (
                      formatCurrency(0)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentBadgeVariant(sale.payment_status)}>
                      {(sale.payment_status ?? "PAID").replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sale.status === "COMPLETED" || sale.status === "AMENDED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(when)}</TableCell>
                  <TableCell>
                    {canManage || canReceivePayment ? (
                      <SalesActionsMenu
                        saleId={sale.id}
                        status={sale.status}
                        total={sale.total}
                        amountDue={due}
                        paymentVersion={Number(sale.payment_version ?? 1)}
                        invoiceLabel={invoiceNum}
                        canManage={canManage}
                        canReceivePayment={canReceivePayment}
                        onReceivePayment={canPay ? () => setPaySale(sale) : undefined}
                      />
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          render={<Link href={`/sales/${sale.id}`} />}
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination page={page} pageSize={PAGE_SIZE} total={sales.length} onPageChange={setPage} />

      {paySale ? (
        <ReceivePaymentDialog
          open={Boolean(paySale)}
          onOpenChange={(open) => {
            if (!open) setPaySale(null);
          }}
          saleId={paySale.id}
          amountDue={Number(paySale.amount_due ?? 0)}
          paymentVersion={Number(paySale.payment_version ?? 1)}
          invoiceLabel={
            Array.isArray(paySale.invoice)
              ? paySale.invoice[0]?.invoice_number
              : paySale.invoice?.invoice_number
          }
        />
      ) : null}
    </div>
  );
}

export function SalesTableCard({
  sales,
  canManage = false,
  canReceivePayment = false,
  emptyLabel,
}: {
  sales: SaleRow[];
  canManage?: boolean;
  canReceivePayment?: boolean;
  emptyLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All sales</CardTitle>
      </CardHeader>
      <CardContent>
        <SalesTable
          sales={sales}
          canManage={canManage}
          canReceivePayment={canReceivePayment || canManage}
          emptyLabel={emptyLabel}
        />
      </CardContent>
    </Card>
  );
}

export function SalesSummaryCards({
  count,
  total,
  outstanding,
}: {
  count: number;
  total: number;
  outstanding?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{count}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(outstanding ?? 0)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
