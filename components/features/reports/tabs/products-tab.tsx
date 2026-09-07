"use client";

import { formatCurrency } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { ProductsReport, ProductReportRow } from "@/lib/actions/reports";
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

function UsageBadge({ kind }: { kind: ProductReportRow["usageKind"] }) {
  if (kind === "SALON") return <Badge variant="secondary">In-house</Badge>;
  if (kind === "RETAIL") return <Badge variant="default">Customer</Badge>;
  return <Badge variant="outline">Both</Badge>;
}

function ProductTable({
  rows,
  mode,
}: {
  rows: ProductReportRow[];
  mode: "retail" | "salon" | "all";
}) {
  if (!rows.length) {
    return (
      <ReportEmpty
        message={
          mode === "salon"
            ? "No in-house / salon stock was used in this period."
            : mode === "retail"
              ? "No customer product sales in this period."
              : "No product activity in this period."
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Type</TableHead>
            {mode !== "salon" ? <TableHead className="text-right">Retail qty</TableHead> : null}
            {mode !== "retail" ? <TableHead className="text-right">Salon qty</TableHead> : null}
            {mode !== "salon" ? <TableHead className="text-right">Revenue</TableHead> : null}
            {mode === "salon" ? (
              <TableHead className="text-right">Salon COGS</TableHead>
            ) : (
              <TableHead className="text-right">COGS</TableHead>
            )}
            {mode !== "salon" ? <TableHead className="text-right">Profit</TableHead> : null}
            <TableHead className="text-right">Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.productId} className={cn(r.belowCost && "bg-destructive/5")}>
              <TableCell>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.sku ?? "No SKU"}
                  {r.category ? ` · ${r.category}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <UsageBadge kind={r.usageKind} />
              </TableCell>
              {mode !== "salon" ? (
                <TableCell className="text-right">{r.qtySold}</TableCell>
              ) : null}
              {mode !== "retail" ? (
                <TableCell className="text-right">{r.qtySalonUsed}</TableCell>
              ) : null}
              {mode !== "salon" ? (
                <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
              ) : null}
              <TableCell className="text-right text-orange-700">
                {formatCurrency(mode === "salon" ? r.salonCogs : r.cogs)}
              </TableCell>
              {mode !== "salon" ? (
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    r.profit < 0 ? "text-destructive" : "text-emerald-700"
                  )}
                >
                  {formatCurrency(r.profit)}
                </TableCell>
              ) : null}
              <TableCell className="text-right">{r.currentStock}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProductsTab({ data }: { data: ProductsReport }) {
  const k = data.kpis;
  const c = data.catalogCounts;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Full stock picture for Owner/Admin:{" "}
        <span className="font-medium text-foreground">Customer products</span> (POS sales) and{" "}
        <span className="font-medium text-foreground">In-house products</span> (used inside
        services) are shown separately below, plus a combined view.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Catalog · Customer" value={String(c.retail)} />
        <KpiCard label="Catalog · In-house" value={String(c.salon)} />
        <KpiCard label="Catalog · Both" value={String(c.both)} />
        <KpiCard label="Catalog · Total" value={String(c.total)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Customer revenue" value={formatCurrency(k.revenue.current)} compare={k.revenue} />
        <KpiCard label="Customer units sold" value={String(k.unitsSold.current)} compare={k.unitsSold} />
        <KpiCard label="Customer COGS" value={formatCurrency(k.retailCogs.current)} compare={k.retailCogs} />
        <KpiCard
          label="In-house units used"
          value={String(k.unitsSalonUsed.current)}
          compare={k.unitsSalonUsed}
        />
        <KpiCard
          label="In-house COGS"
          value={formatCurrency(k.salonCogs.current)}
          compare={k.salonCogs}
        />
        <KpiCard label="Total product COGS" value={formatCurrency(k.cogs.current)} compare={k.cogs} />
        <KpiCard label="Gross profit" value={formatCurrency(k.grossProfit.current)} compare={k.grossProfit} />
        <KpiCard label="Margin" value={`${k.margin.current.toFixed(1)}%`} compare={k.margin} />
      </div>

      {data.notes?.length ? (
        <ul className="list-disc space-y-1 rounded-lg border px-4 py-3 text-sm text-muted-foreground pl-8">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Customer revenue by product" defaultOpen>
          <ReportBarChart
            data={data.top10.map((r) => ({ label: r.name, value: r.revenue }))}
            horizontal
            currency
            emptyMessage="No customer product sales."
          />
        </ReportSection>
        <ReportSection title="In-house COGS by product" defaultOpen>
          <ReportBarChart
            data={data.salonRows.slice(0, 10).map((r) => ({
              label: r.name,
              value: r.salonCogs,
            }))}
            horizontal
            currency
            emptyMessage="No in-house stock used."
          />
        </ReportSection>
      </div>

      <ReportSection title="1) Customer products sold (POS)" defaultOpen>
        <ProductTable rows={data.retailRows} mode="retail" />
      </ReportSection>

      <ReportSection title="2) In-house products used in services" defaultOpen>
        <ProductTable rows={data.salonRows} mode="salon" />
      </ReportSection>

      <ReportSection title="3) In-house cost by service" defaultOpen>
        {!data.salonByService.length ? (
          <ReportEmpty message="No salon stock attributed to services in this period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Units used</TableHead>
                  <TableHead className="text-right">Salon COGS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.salonByService.map((r) => (
                  <TableRow key={r.serviceId}>
                    <TableCell className="font-medium">{r.serviceName}</TableCell>
                    <TableCell className="text-right">{r.tickets}</TableCell>
                    <TableCell className="text-right">{r.unitsUsed}</TableCell>
                    <TableCell className="text-right text-orange-700">
                      {formatCurrency(r.salonCogs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSection>

      <ReportSection
        title="4) Combined product activity"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `products-stock-use-${data.from}-${data.to}.csv`,
                [
                  "Product",
                  "Type",
                  "SKU",
                  "Category",
                  "Retail qty",
                  "Salon qty",
                  "Revenue",
                  "Retail COGS",
                  "Salon COGS",
                  "Total COGS",
                  "Profit",
                  "Stock",
                ],
                data.detail.map((r) => [
                  r.name,
                  r.usageKind,
                  r.sku ?? "",
                  r.category ?? "",
                  r.qtySold,
                  r.qtySalonUsed,
                  r.revenue,
                  r.retailCogs,
                  r.salonCogs,
                  r.cogs,
                  r.profit,
                  r.currentStock,
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        <div className="mb-3">
          <ReportDonutChart
            data={[
              { name: "Customer COGS", value: k.retailCogs.current },
              { name: "In-house COGS", value: k.salonCogs.current },
            ].filter((d) => d.value > 0)}
            currency
            emptyMessage="No product COGS in period."
          />
        </div>
        <ProductTable rows={data.detail} mode="all" />
      </ReportSection>
    </div>
  );
}
