import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuickActionsProps = {
  stats: {
    total: number;
    completed: number;
    upcoming: number;
    cancelled: number;
  };
  todayFinances?: {
    salesRevenue: number;
    advancesCollected: number;
    totalExpenses: number;
    staffPayments: number;
    productCogs: number;
    productGrossProfit: number;
    productUnitsSold: number;
    productRetailRevenue: number;
    inventoryValueAtCost: number;
    netProfit: number;
    netCashFlow: number;
  } | null;
};

export function QuickActions({ stats, todayFinances }: QuickActionsProps) {
  const completionRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const rows = [
    { label: "Today's bookings", value: stats.total, color: "bg-primary" },
    { label: "Completed", value: stats.completed, color: "bg-[#16a34a]" },
    { label: "Pending", value: stats.upcoming, color: "bg-[#d97706]" },
    { label: "Cancelled", value: stats.cancelled, color: "bg-destructive" },
  ];

  return (
    <div className="dashboard-card flex flex-col">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Today&apos;s Summary</h3>
        <p className="text-xs text-muted-foreground">Operational overview</p>
      </div>

      <div className="space-y-5 p-5">
        {todayFinances ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Today&apos;s sales
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(todayFinances.salesRevenue)}
              </p>
              {todayFinances.productRetailRevenue > 0 && (
                <p className="mt-1 text-xs text-primary">
                  Includes {formatCurrency(todayFinances.productRetailRevenue)} from stock (
                  {todayFinances.productUnitsSold} units)
                </p>
              )}
            </div>

            {(todayFinances.productUnitsSold > 0 || todayFinances.inventoryValueAtCost > 0) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Stock sold</span>
                  <span className="font-semibold">
                    {todayFinances.productUnitsSold > 0
                      ? `${todayFinances.productUnitsSold} · ${formatCurrency(todayFinances.productRetailRevenue)}`
                      : "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between gap-2">
                  <span className="text-muted-foreground">Stock on hand</span>
                  <span className="font-semibold">
                    {formatCurrency(todayFinances.inventoryValueAtCost)}
                  </span>
                </div>
                {todayFinances.productGrossProfit > 0 && (
                  <div className="mt-1.5 flex justify-between gap-2 text-green-700">
                    <span>Stock profit today</span>
                    <span className="font-semibold">
                      {formatCurrency(todayFinances.productGrossProfit)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {todayFinances.advancesCollected > 0 && (
              <div className="rounded-lg border bg-background p-2.5 text-sm">
                <p className="text-[10px] uppercase text-muted-foreground">Advances collected</p>
                <p className="font-semibold text-green-700">
                  {formatCurrency(todayFinances.advancesCollected)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border bg-background p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Expenses</p>
                <p className="font-semibold text-orange-700">
                  {formatCurrency(todayFinances.totalExpenses)}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Staff paid</p>
                <p className="font-semibold text-orange-700">
                  {formatCurrency(todayFinances.staffPayments)}
                </p>
              </div>
              {todayFinances.productCogs > 0 && (
                <div className="rounded-lg border bg-background p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Stock COGS</p>
                  <p className="font-semibold text-orange-700">
                    {formatCurrency(todayFinances.productCogs)}
                  </p>
                </div>
              )}
              <div className="col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Net profit today</p>
                <p
                  className={`text-lg font-bold ${todayFinances.netProfit >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {formatCurrency(todayFinances.netProfit)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Sales − expenses − staff − stock COGS
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Today&apos;s sales
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(0)}</p>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row) => {
            const pct = stats.total > 0 ? (row.value / stats.total) * 100 : 0;
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{row.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", row.color)}
                    style={{ width: `${Math.max(pct, row.value > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Completion rate</span>
            <span className="font-semibold text-foreground">{completionRate}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" render={<Link href="/appointments" />}>
            Appointments
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/finances" />}>
            Finances
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/products" />}>
            Inventory
          </Button>
          <Button size="sm" render={<Link href="/pos" />}>
            New Sale
          </Button>
        </div>
      </div>
    </div>
  );
}
