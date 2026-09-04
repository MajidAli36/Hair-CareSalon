"use client";

import Link from "next/link";
import type { DuesReport } from "@/lib/actions/reports/dues";
import { formatCurrency, formatDate } from "@/lib/format";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DuesTab({ data }: { data: DuesReport }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total outstanding" value={formatCurrency(data.kpis.totalOutstanding)} />
        <KpiCard label="Customers with due" value={String(data.kpis.customersWithDue)} />
        <KpiCard label="Invoices with due" value={String(data.kpis.invoicesWithDue)} />
        <KpiCard label="Collected today" value={formatCurrency(data.kpis.collectedToday)} />
        <KpiCard label="Collected this month" value={formatCurrency(data.kpis.collectedThisMonth)} />
        <KpiCard label="Overdue amount" value={formatCurrency(data.kpis.overdueAmount)} />
      </div>

      <ReportSection title="Aging" description="Receivables by days outstanding">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.aging.map((b) => (
            <div key={b.label} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className="text-lg font-semibold">{formatCurrency(b.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {b.invoiceCount} inv · {b.customerCount} cust
              </p>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Due invoices" description="Open receivables">
        {data.ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Last payment</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ledger.map((row) => (
                <TableRow key={row.saleId}>
                  <TableCell>
                    {row.customerId ? (
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="text-primary hover:underline"
                      >
                        {row.customerName}
                      </Link>
                    ) : (
                      row.customerName
                    )}
                  </TableCell>
                  <TableCell>{row.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/sales/${row.saleId}`} className="text-primary hover:underline">
                      {row.invoiceNumber ?? row.saleId.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.invoiceDate ? formatDate(row.invoiceDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.paid)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(row.due)}
                  </TableCell>
                  <TableCell>
                    {row.lastPaymentAt ? formatDate(row.lastPaymentAt) : "—"}
                  </TableCell>
                  <TableCell>{row.daysOutstanding}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "OVERDUE" ? "destructive" : "secondary"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ReportSection>

      {data.notes.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
