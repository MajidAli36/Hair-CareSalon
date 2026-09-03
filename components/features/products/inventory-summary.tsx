import { formatCurrency } from "@/lib/format";
import type { InventorySummary } from "@/lib/inventory/valuation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InventorySummaryCardsProps = {
  summary: InventorySummary;
};

export function InventorySummaryCards({ summary }: InventorySummaryCardsProps) {
  return (
    <div className="space-y-4">
      <Card className="border-dashed bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How inventory value is calculated</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Each product has a <strong>cost price</strong> (what you pay) and a{" "}
            <strong>retail price</strong> (POS selling price). Stock value uses your current
            on-hand quantity × price:
            <span className="mt-2 block font-mono text-xs text-foreground">
              Stock value (cost) = stock × cost price · Stock value (retail) = stock × retail
              price · Margin = retail − cost
            </span>
            POS checkout reduces stock automatically and charges the customer the retail price.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total units on hand</CardDescription>
            <CardTitle className="text-2xl">{summary.totalUnits}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across {summary.productCount} products
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inventory value (at cost)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalValueAtCost)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Money tied up in stock (Σ stock × cost)
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>If sold at retail</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalValueAtRetail)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Potential revenue (Σ stock × retail)
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Potential profit on hand</CardDescription>
            <CardTitle className="text-2xl text-green-700">
              {formatCurrency(summary.totalPotentialProfit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Retail value − cost value · {summary.lowStockCount} low-stock items
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
