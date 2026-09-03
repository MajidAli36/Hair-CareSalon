import Link from "next/link";
import { Package, ShoppingBag, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type DashboardStockToday = {
  unitsSold: number;
  retailRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  marginPercent: number;
  inventoryValueAtCost: number;
  inventoryValueAtRetail: number;
  inventoryUnitsOnHand: number;
  serviceRevenue: number;
  lowStockCount: number;
  productsSold: { name: string; qty: number; revenue: number; profit: number }[];
};

type DashboardStockPanelProps = {
  stock: DashboardStockToday;
};

export function DashboardStockPanel({ stock }: DashboardStockPanelProps) {
  const hasSales = stock.unitsSold > 0;

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stock &amp; inventory today</h3>
          <p className="text-xs text-muted-foreground">
            Product sales at POS and what remains on the shelf
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" render={<Link href="/finances" />}>
            Finances
          </Button>
          <Button type="button" size="sm" variant="outline" render={<Link href="/products" />}>
            Inventory
          </Button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* Stock sold today */}
        <div
          className={`border-b border-border p-5 lg:border-b-0 lg:border-r ${
            hasSales ? "bg-primary/5" : ""
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="size-4 text-primary" />
            </div>
            <span className="text-sm font-medium">Stock sold today</span>
          </div>

          {hasSales ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(stock.retailRevenue)}
                </p>
                <Badge className="bg-primary">{stock.unitsSold} units</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">COGS</p>
                  <p className="font-semibold text-orange-700">
                    {formatCurrency(stock.costOfGoodsSold)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Profit</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(stock.grossProfit)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({stock.marginPercent}%)
                    </span>
                  </p>
                </div>
              </div>
              {stock.productsSold.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-3">
                  {stock.productsSold.map((p) => (
                    <li
                      key={p.name}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {p.qty}× {formatCurrency(p.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div>
              <p className="text-2xl font-bold text-muted-foreground">Rs 0</p>
              <p className="mt-2 text-sm text-muted-foreground">
                No products sold yet today. Add items from{" "}
                <Link href="/pos" className="text-primary hover:underline">
                  POS
                </Link>{" "}
                to track stock revenue here.
              </p>
              {stock.serviceRevenue > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Service sales today: {formatCurrency(stock.serviceRevenue)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stock on hand */}
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#16a34a]/10">
              <Package className="size-4 text-[#16a34a]" />
            </div>
            <span className="text-sm font-medium">Stock on hand</span>
            {stock.lowStockCount > 0 && (
              <Badge variant="secondary" className="bg-[#d97706]/10 text-[#d97706]">
                {stock.lowStockCount} low
              </Badge>
            )}
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stock.inventoryValueAtCost)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {stock.inventoryUnitsOnHand} units at cost · retail value{" "}
            {formatCurrency(stock.inventoryValueAtRetail)}
          </p>
          {stock.inventoryUnitsOnHand > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5 shrink-0" />
              Potential profit if all sold at retail:{" "}
              <span className="font-medium text-green-700">
                {formatCurrency(stock.inventoryValueAtRetail - stock.inventoryValueAtCost)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
