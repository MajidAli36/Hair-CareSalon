"use client";

import { formatCurrency } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { ProductsReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportBarChart,
  ReportDonutChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ProductsTab({ data }: { data: ProductsReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Product revenue" value={formatCurrency(k.revenue.current)} compare={k.revenue} />
        <KpiCard label="Units sold" value={String(k.unitsSold.current)} compare={k.unitsSold} />
        <KpiCard label="COGS" value={formatCurrency(k.cogs.current)} compare={k.cogs} />
        <KpiCard label="Gross profit" value={formatCurrency(k.grossProfit.current)} compare={k.grossProfit} />
        <KpiCard label="Margin" value={`${k.margin.current.toFixed(1)}%`} compare={k.margin} />
        <KpiCard label="Sold below cost" value={String(k.belowCostCount.current)} invertTrend />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Top products" defaultOpen>
          <ReportBarChart
            data={data.top10.map((r) => ({ label: r.name, value: r.revenue }))}
            horizontal
            currency
            emptyMessage="No product sales found for the selected period."
          />
        </ReportSection>
        <ReportSection title="By category" defaultOpen>
          <ReportDonutChart data={data.byCategory} currency emptyMessage="No product sales." />
        </ReportSection>
      </div>

      <ReportSection
        title="Product profitability"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `products-${data.from}-${data.to}.csv`,
                ["Product", "SKU", "Category", "Qty", "Revenue", "COGS", "Profit", "Margin %", "Stock", "Below cost"],
                data.detail.map((r) => [
                  r.name,
                  r.sku ?? "",
                  r.category ?? "",
                  r.qtySold,
                  r.revenue,
                  r.cogs,
                  r.profit,
                  r.marginPercent,
                  r.currentStock,
                  r.belowCost ? "YES" : "",
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        {!data.detail.length ? (
          <ReportEmpty message="No product sales found for the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.detail.map((r) => (
                  <TableRow key={r.productId} className={cn(r.belowCost && "bg-destructive/5")}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.sku ?? "No SKU"} · Stock {r.currentStock}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{r.qtySold}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.cogs)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        r.profit < 0 ? "text-destructive" : "text-emerald-700"
                      )}
                    >
                      {formatCurrency(r.profit)}
                    </TableCell>
                    <TableCell className={cn("text-right", r.marginPercent < 0 && "text-destructive")}>
                      {r.marginPercent}%
                    </TableCell>
                    <TableCell>
                      {r.belowCost ? <Badge variant="destructive">Sold below cost</Badge> : null}
                    </TableCell>
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
