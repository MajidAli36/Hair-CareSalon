"use client";

import Link from "next/link";
import { useState } from "react";
import type { CustomerHistory } from "@/lib/actions/customers";
import { AccountReceivePaymentDialog } from "@/components/features/customers/account-receive-payment-dialog";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FinancialSummary = {
  totalPurchases: number;
  totalPaid: number;
  outstandingDue: number;
  totalRefunds: number;
  totalDiscounts: number;
  dueInvoiceCount: number;
};

type CustomerHistoryPanelProps = {
  history: CustomerHistory;
  customerId: string;
  financial: FinancialSummary;
  canReceivePayment?: boolean;
  canViewStatement?: boolean;
  showDueOnly?: boolean;
};

export function CustomerHistoryPanel({
  history,
  customerId,
  financial,
  canReceivePayment = false,
  canViewStatement = false,
  showDueOnly = false,
}: CustomerHistoryPanelProps) {
  const [payOpen, setPayOpen] = useState(false);

  const sales = showDueOnly
    ? history.sales.filter((s) => Number((s as { amount_due?: number }).amount_due ?? 0) > 0)
    : history.sales;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Customer financial summary</h2>
          <div className="flex flex-wrap gap-2">
            {canReceivePayment && financial.outstandingDue > 0 ? (
              <Button size="sm" onClick={() => setPayOpen(true)}>
                Receive payment
              </Button>
            ) : null}
            {canViewStatement ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/customers/${customerId}/statement`} />}
              >
                View statement
              </Button>
            ) : null}
            {financial.dueInvoiceCount > 0 ? (
              <Button
                size="sm"
                variant={showDueOnly ? "default" : "outline"}
                render={
                  <Link
                    href={
                      showDueOnly
                        ? `/customers/${customerId}`
                        : `/customers/${customerId}?tab=dues`
                    }
                  />
                }
              >
                {showDueOnly
                  ? "Show all sales"
                  : `View due invoices (${financial.dueInvoiceCount})`}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total purchases</CardDescription>
              <CardTitle className="text-xl">
                {formatCurrency(financial.totalPurchases)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total paid</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(financial.totalPaid)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding due</CardDescription>
              <CardTitle className="text-xl text-amber-700 dark:text-amber-400">
                {formatCurrency(financial.outstandingDue)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total refunds</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(financial.totalRefunds)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total discounts</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(financial.totalDiscounts)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed sales</CardDescription>
            <CardTitle className="text-2xl">{history.stats.visitCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Appointments</CardDescription>
            <CardTitle className="text-2xl">{history.stats.appointmentCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lifetime purchases</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(history.stats.totalSpent)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{showDueOnly ? "Due invoices" : "Sales history"}</CardTitle>
          <CardDescription>
            {showDueOnly
              ? "Invoices with an outstanding balance"
              : "Purchases linked to this customer"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showDueOnly ? "No outstanding invoices." : "No sales yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Sale</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const inv = Array.isArray(sale.invoice) ? sale.invoice[0] : sale.invoice;
                  const s = sale as typeof sale & {
                    amount_paid?: number;
                    amount_due?: number;
                    payment_status?: string;
                  };
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {sale.completed_at ? formatDate(sale.completed_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="text-primary hover:underline"
                        >
                          {inv?.invoice_number ?? sale.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {sale.items?.map((i) => i.name).join(", ") || "—"}
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
                      <TableCell>
                        <Badge variant="outline">
                          {(s.payment_status ?? "—").replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.amount_paid ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(s.amount_due ?? 0) > 0 ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {formatCurrency(s.amount_due ?? 0)}
                          </span>
                        ) : (
                          formatCurrency(0)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{formatDateTime(a.scheduled_at)}</TableCell>
                    <TableCell>{a.staff?.full_name ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {a.services?.map((s) => s.service_name).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AccountReceivePaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        customerId={customerId}
        outstandingDue={financial.outstandingDue}
      />
    </div>
  );
}
