import Link from "next/link";
import type { FinancialSummary } from "@/lib/actions/finances";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InventoryFinancesPanelProps = {
  summary: FinancialSummary;
};

export function InventoryFinancesPanel({ summary }: InventoryFinancesPanelProps) {
  const hasSales = summary.productUnitsSold > 0;

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Stock &amp; inventory sales</CardTitle>
            <CardDescription>
              What you sold from stock vs what remains on the shelf — for{" "}
              {summary.periodLabel}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" render={<Link href="/products" />}>
              Manage stock
            </Button>
            <Button type="button" size="sm" variant="outline" render={<Link href="/reports" />}>
              Full report
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StockMetric
            label="Stock sold (period)"
            value={`${summary.productUnitsSold} units`}
            detail={`Revenue ${formatCurrency(summary.productRetailRevenue)}`}
            highlight={hasSales}
          />
          <StockMetric
            label="Revenue from stock"
            value={formatCurrency(summary.productRetailRevenue)}
            detail="Retail price at POS"
            highlight={hasSales}
          />
          <StockMetric
            label="Cost of stock sold (COGS)"
            value={formatCurrency(summary.productCogs)}
            detail="Qty sold × cost price"
            variant="cost"
          />
          <StockMetric
            label="Profit from stock"
            value={formatCurrency(summary.productGrossProfit)}
            detail={
              hasSales
                ? `${summary.productMarginPercent}% margin on products`
                : "Sell products at POS to earn"
            }
            variant="profit"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3 rounded-xl border bg-muted/20 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stock on hand now
            </p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.inventoryValueAtCost)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.inventoryUnitsOnHand} units at cost · retail{" "}
              {formatCurrency(summary.inventoryValueAtRetail)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Service revenue (period)
            </p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.serviceRevenue)}</p>
            <p className="text-xs text-muted-foreground">Hair &amp; salon services at POS</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total POS revenue
            </p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.salesRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              Services {formatCurrency(summary.serviceRevenue)} + stock{" "}
              {formatCurrency(summary.productRetailRevenue)}
            </p>
          </div>
        </div>

        {!hasSales ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">No stock sold in this period</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your {formatCurrency(summary.inventoryValueAtCost)} stock on hand is ready to sell.
              Add products to cart at{" "}
              <Link href="/pos" className="text-primary hover:underline">
                POS
              </Link>{" "}
              — revenue and COGS will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product sold</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.productSaleRows.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      {row.sku && (
                        <span className="ml-2 text-xs text-muted-foreground">{row.sku}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{row.qtySold}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.retailRevenue)}
                    </TableCell>
                    <TableCell className="text-right text-orange-700">
                      {formatCurrency(row.costOfGoodsSold)}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {formatCurrency(row.grossProfit)}
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {row.marginPercent}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total stock sold</TableCell>
                  <TableCell className="text-right">{summary.productUnitsSold}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(summary.productRetailRevenue)}
                  </TableCell>
                  <TableCell className="text-right text-orange-700">
                    {formatCurrency(summary.productCogs)}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {formatCurrency(summary.productGrossProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StockMetric({
  label,
  value,
  detail,
  highlight,
  variant,
}: {
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
  variant?: "cost" | "profit";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-primary/30 bg-primary/5" : "bg-background"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          variant === "profit" ? "text-green-700" : variant === "cost" ? "text-orange-700" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
