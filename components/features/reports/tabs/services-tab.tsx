"use client";

import { formatCurrency } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { ServicesReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportBarChart,
  ReportDonutChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty, ReportUnavailable } from "@/components/features/reports/ui/report-states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ServicesTab({ data }: { data: ServicesReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Service revenue" value={formatCurrency(k.serviceRevenue.current)} compare={k.serviceRevenue} />
        <KpiCard label="Services sold" value={String(k.servicesSold.current)} compare={k.servicesSold} />
        <KpiCard label="Avg service value" value={formatCurrency(k.avgServiceValue.current)} compare={k.avgServiceValue} />
        <KpiCard label="Unique services" value={String(k.uniqueServices.current)} compare={k.uniqueServices} />
      </div>
      <ReportUnavailable reason={data.unavailable.profit} />
      <p className="text-xs text-muted-foreground">{k.serviceDiscountsNote}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Top 10 services" defaultOpen>
          <ServiceMini rows={data.top10} empty="No service sales found for the selected period." />
        </ReportSection>
        <ReportSection title="Bottom 10 services" defaultOpen>
          <ServiceMini rows={data.bottom10} empty="No service sales found for the selected period." />
        </ReportSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="By category" defaultOpen>
          <ReportDonutChart data={data.byCategory} currency emptyMessage="No categorized service sales." />
        </ReportSection>
        <ReportSection title="Peak hours" description="Service units by sale hour" defaultOpen>
          <ReportBarChart data={data.byHour} valueLabel="Qty" emptyMessage="No service sales." />
        </ReportSection>
      </div>

      <ReportSection
        title="Service detail"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `services-${data.from}-${data.to}.csv`,
                ["Service", "Category", "Qty", "Revenue", "Avg price", "% of service revenue"],
                data.detail.map((r) => [
                  r.name,
                  r.category ?? "",
                  r.qty,
                  r.revenue,
                  r.avgPrice,
                  r.pctOfServiceRevenue.toFixed(1),
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        {!data.detail.length ? (
          <ReportEmpty message="No service sales found for the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.detail.map((r) => (
                  <TableRow key={r.serviceId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.category ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.avgPrice)}</TableCell>
                    <TableCell className="text-right">{r.pctOfServiceRevenue.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSection>
    </div>
  );
}

function ServiceMini({
  rows,
  empty,
}: {
  rows: ServicesReport["top10"];
  empty: string;
}) {
  if (!rows.length) return <ReportEmpty message={empty} />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.serviceId + r.name}>
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
