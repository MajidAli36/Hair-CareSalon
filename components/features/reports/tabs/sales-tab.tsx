"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { SalesReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportBarChart,
  ReportDonutChart,
  ReportLineChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SalesTab({ data }: { data: SalesReport }) {
  const [q, setQ] = useState("");
  const k = data.kpis;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data.ledger;
    return data.ledger.filter(
      (r) =>
        (r.invoiceNumber ?? "").toLowerCase().includes(term) ||
        (r.customerName ?? "").toLowerCase().includes(term) ||
        r.itemSummary.toLowerCase().includes(term) ||
        r.paymentMethod.toLowerCase().includes(term)
    );
  }, [data.ledger, q]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Completed sales" value={String(k.completedSales.current)} compare={k.completedSales} />
        <KpiCard label="Voided sales" value={String(k.voidedSales.current)} compare={k.voidedSales} invertTrend />
        <KpiCard label="Gross sales" value={formatCurrency(k.grossSales.current)} compare={k.grossSales} hint="Subtotals" />
        <KpiCard label="Net sales" value={formatCurrency(k.netSales.current)} compare={k.netSales} hint="Ticket totals" />
        <KpiCard label="Discounts" value={formatCurrency(k.discounts.current)} compare={k.discounts} invertTrend />
        <KpiCard label="Avg sale" value={formatCurrency(k.aov.current)} compare={k.aov} />
        <KpiCard label="Items sold" value={String(k.itemsSold.current)} compare={k.itemsSold} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Sales by day" defaultOpen>
          <ReportLineChart data={data.byDay} currency emptyMessage="No sales for this period." />
        </ReportSection>
        <ReportSection title="Sales by hour" description="Transaction count by hour" defaultOpen>
          <ReportBarChart data={data.byHour} emptyMessage="No sales for this period." valueLabel="Sales" />
        </ReportSection>
      </div>

      <ReportSection title="Payment methods" defaultOpen>
        <ReportDonutChart data={data.byPayment} currency emptyMessage="No payments linked to period sales." />
      </ReportSection>

      <ReportSection
        title="Sales ledger"
        description="Completed sales in range"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `sales-ledger-${data.from}-${data.to}.csv`,
                ["Date", "Invoice", "Customer", "Items", "Subtotal", "Discount", "Tax", "Total", "Payment", "Status"],
                filtered.map((r) => [
                  r.completedAt ?? "",
                  r.invoiceNumber ?? "",
                  r.customerName ?? "",
                  r.itemSummary,
                  r.subtotal,
                  r.discount,
                  r.tax,
                  r.total,
                  r.paymentMethod,
                  r.status,
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        <Input
          placeholder="Search invoice, customer, items…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3 max-w-sm print:hidden"
        />
        {!filtered.length ? (
          <ReportEmpty message="No sales found for the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.completedAt ? formatDateTime(r.completedAt) : "—"}
                    </TableCell>
                    <TableCell className="font-medium">{r.invoiceNumber ?? "—"}</TableCell>
                    <TableCell>{r.customerName ?? "Walk-in"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {r.itemSummary || "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
                    <TableCell>{r.paymentMethod}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > 200 ? (
              <p className="mt-2 text-xs text-muted-foreground">Showing first 200 of {filtered.length}. Export CSV for full list.</p>
            ) : null}
          </div>
        )}
      </ReportSection>
    </div>
  );
}
