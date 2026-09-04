"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { FinanceReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import { ReportBarChart, ReportDonutChart } from "@/components/features/reports/ui/report-charts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function FinanceTab({ data }: { data: FinanceReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Profitability uses recorded expenses and staff payments. Enter costs on Finances.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/finances" />}>
          Open Finances
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Gross (subtotal)" value={formatCurrency(k.grossRevenue.current)} compare={k.grossRevenue} />
        <KpiCard label="Discounts" value={formatCurrency(k.discounts.current)} compare={k.discounts} invertTrend />
        <KpiCard label="Net ticket revenue" value={formatCurrency(k.netRevenue.current)} compare={k.netRevenue} />
        <KpiCard label="Product COGS" value={formatCurrency(k.cogs.current)} compare={k.cogs} />
        <KpiCard label="Gross profit" value={formatCurrency(k.grossProfit.current)} compare={k.grossProfit} />
        <KpiCard label="Gross margin" value={`${k.grossMargin.current.toFixed(1)}%`} compare={k.grossMargin} />
        <KpiCard label="Expenses" value={formatCurrency(k.expenses.current)} compare={k.expenses} invertTrend />
        <KpiCard label="Staff payments" value={formatCurrency(k.staffPayments.current)} compare={k.staffPayments} invertTrend />
        <KpiCard label="Net profit" value={formatCurrency(k.netProfit.current)} compare={k.netProfit} />
        <KpiCard label="Net margin" value={`${k.netMargin.current.toFixed(1)}%`} compare={k.netMargin} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Financial waterfall" defaultOpen>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.waterfall.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        row.value < 0 ? "text-destructive" : row.label === "Net profit" ? "font-semibold" : ""
                      )}
                    >
                      {formatCurrency(row.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ReportSection>
        <ReportSection title="Expenses by category" defaultOpen>
          <ReportDonutChart
            data={data.expensesByCategory}
            currency
            emptyMessage="No expenses recorded for this period."
          />
        </ReportSection>
      </div>

      <ReportSection title="Expense categories (bar)" defaultOpen={false}>
        <ReportBarChart
          data={data.expensesByCategory.map((e) => ({ label: e.name, value: e.value }))}
          horizontal
          currency
          emptyMessage="No expenses recorded for this period."
        />
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
