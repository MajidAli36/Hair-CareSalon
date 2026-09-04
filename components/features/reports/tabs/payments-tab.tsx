"use client";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { PaymentsReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportBarChart,
  ReportDonutChart,
  ReportLineChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PaymentsTab({ data }: { data: PaymentsReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total payments" value={formatCurrency(k.totalPayments.current)} compare={k.totalPayments} />
        <KpiCard label="Cash" value={formatCurrency(k.cash.current)} compare={k.cash} />
        <KpiCard label="Card" value={formatCurrency(k.card.current)} compare={k.card} />
        <KpiCard label="Other" value={formatCurrency(k.other.current)} compare={k.other} />
        <KpiCard label="Discounts given" value={formatCurrency(k.discounts.current)} compare={k.discounts} invertTrend />
        <KpiCard label="Deposit refunds" value={formatCurrency(k.depositRefunds.current)} compare={k.depositRefunds} invertTrend />
        <KpiCard label="Transactions" value={String(k.transactionCount.current)} compare={k.transactionCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Payment method mix" defaultOpen>
          <ReportDonutChart data={data.byMethod} currency emptyMessage="No payments in this period." />
        </ReportSection>
        <ReportSection title="Payment trend" defaultOpen>
          <ReportLineChart data={data.byDay} currency emptyMessage="No payments in this period." />
        </ReportSection>
      </div>

      <ReportSection title="Cashier / user performance" defaultOpen>
        {!data.cashierPerformance.length ? (
          <ReportEmpty message="No cashier activity in this period." />
        ) : (
          <ReportBarChart
            data={data.cashierPerformance.map((c) => ({ label: c.name, value: c.revenue }))}
            horizontal
            currency
            emptyMessage="No cashier activity."
          />
        )}
      </ReportSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Discounted sales" defaultOpen={false}>
          {!data.discountSales.length ? (
            <ReportEmpty message="No discounted sales in this period." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.discountSales.slice(0, 50).map((r) => (
                    <TableRow key={r.saleId}>
                      <TableCell className="text-xs">
                        {r.completedAt ? formatDateTime(r.completedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(r.discount)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ReportSection>
        <ReportSection title="Deposit refunds" defaultOpen={false}>
          {!data.depositRefunds.length ? (
            <ReportEmpty message="No deposit refunds in this period." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.depositRefunds.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {r.refundedAt ? formatDateTime(r.refundedAt) : "—"}
                      </TableCell>
                      <TableCell>{r.method ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ReportSection>
      </div>

      <ReportSection
        title="Payment ledger"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `payments-${data.from}-${data.to}.csv`,
                ["When", "Sale", "Method", "Amount", "Reference"],
                data.ledger.map((r) => [r.paidAt, r.saleId, r.method, r.amount, r.reference ?? ""])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        {!data.ledger.length ? (
          <ReportEmpty message="No payments found for the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ledger.slice(0, 250).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(r.paidAt)}
                    </TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSection>

      <ReportSection title="Notes">
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </ReportSection>
    </div>
  );
}
