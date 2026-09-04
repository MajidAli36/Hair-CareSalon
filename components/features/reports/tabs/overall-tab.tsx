"use client";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { OverallReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportDonutChart,
  ReportLineChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function OverallTab({ data }: { data: OverallReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total revenue" value={formatCurrency(k.totalRevenue.current)} compare={k.totalRevenue} />
        <KpiCard label="Net revenue" value={formatCurrency(k.netRevenue.current)} compare={k.netRevenue} hint="Ticket totals" />
        <KpiCard label="Sales" value={String(k.saleCount.current)} compare={k.saleCount} />
        <KpiCard label="Avg ticket" value={formatCurrency(k.aov.current)} compare={k.aov} />
        <KpiCard label="Product gross profit" value={formatCurrency(k.productGrossProfit.current)} compare={k.productGrossProfit} />
        <KpiCard label="Service revenue" value={formatCurrency(k.serviceRevenue.current)} compare={k.serviceRevenue} hint="Line mix" />
        <KpiCard label="Product revenue" value={formatCurrency(k.productRevenue.current)} compare={k.productRevenue} hint="Line mix" />
        <KpiCard label="Package revenue" value={formatCurrency(k.packageRevenue.current)} compare={k.packageRevenue} hint="Line mix" />
        <KpiCard label="Discounts" value={formatCurrency(k.discounts.current)} compare={k.discounts} invertTrend />
        <KpiCard label="Deposit refunds" value={formatCurrency(k.depositRefunds.current)} compare={k.depositRefunds} invertTrend />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Revenue trend" description="Completed ticket revenue by day" defaultOpen>
          <ReportLineChart data={data.revenueByDay} currency emptyMessage="No sales in this period." valueLabel="Revenue" />
        </ReportSection>
        <ReportSection title="Revenue mix" description="Line totals before sale-level discount" defaultOpen>
          <ReportDonutChart data={data.revenueSplit} currency emptyMessage="No line items in this period." />
        </ReportSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Top services" defaultOpen>
          <TopTable rows={data.topServices} empty="No service sales found for the selected period." />
        </ReportSection>
        <ReportSection title="Top products" defaultOpen>
          <TopTable rows={data.topProducts} empty="No product sales found for the selected period." />
        </ReportSection>
      </div>

      <ReportSection title="Notes">
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Generated {formatDateTime(data.generatedAt)}
        </p>
      </ReportSection>
    </div>
  );
}

function TopTable({
  rows,
  empty,
}: {
  rows: { name: string; qty: number; revenue: number }[];
  empty: string;
}) {
  if (!rows.length) return <ReportEmpty message={empty} />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">{r.qty}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function exportOverallCsv(data: OverallReport) {
  downloadCsv(
    `overall-report-${data.from}-${data.to}.csv`,
    ["Metric", "Value"],
    [
      ["Total revenue", data.kpis.totalRevenue.current],
      ["Sales", data.kpis.saleCount.current],
      ["Service revenue (line)", data.kpis.serviceRevenue.current],
      ["Product revenue (line)", data.kpis.productRevenue.current],
      ["Package revenue (line)", data.kpis.packageRevenue.current],
      ["Discounts", data.kpis.discounts.current],
      ["Product gross profit", data.kpis.productGrossProfit.current],
    ]
  );
}
