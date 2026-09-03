"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { ReportsData } from "@/lib/actions/reports";
import { getPeriodRange } from "@/lib/finances/periods";
import { getLocalDateString } from "@/lib/dates/local";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginatedList } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";

type ReportsDashboardProps = {
  report: ReportsData;
  from: string;
  to: string;
};

export function ReportsDashboard({ report, from, to }: ReportsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function applyRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => router.push(`/reports?${params.toString()}`));
  }

  function setPreset(preset: "today" | "week" | "month") {
    const { from: fromStr, to: toStr } = getPeriodRange(preset);
    applyRange(fromStr, toStr);
  }

  const isToday = from === to && from === getLocalDateString();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className={cn(isToday && "border-primary bg-accent text-accent-foreground")}
            onClick={() => setPreset("today")}
          >
            Today
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setPreset("week")}>
            This week
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setPreset("month")}>
            This month
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="rep-from" className="text-xs">From</Label>
            <Input
              id="rep-from"
              type="date"
              value={from}
              className="h-8 w-36"
              onChange={(e) => applyRange(e.target.value, to)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-to" className="text-xs">To</Label>
            <Input
              id="rep-to"
              type="date"
              value={to}
              className="h-8 w-36"
              onChange={(e) => applyRange(from, e.target.value)}
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Period: {report.periodLabel}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total revenue (POS)</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(report.totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Services + products + packages
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed sales</CardDescription>
            <CardTitle className="text-3xl">{report.saleCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Product gross profit</CardDescription>
            <CardTitle className="text-3xl text-green-700">
              {formatCurrency(report.productSales.grossProfit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.productSales.unitsSold} units · {report.productSales.marginPercent}% margin
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stock on hand (cost)</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(report.inventoryOnHand.valueAtCost)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.inventoryOnHand.totalUnits} units · retail value{" "}
            {formatCurrency(report.inventoryOnHand.valueAtRetail)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Service revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.revenueSplit.services)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.revenueSplit.serviceQty} services sold
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Inventory / product revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.revenueSplit.products)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.revenueSplit.productQty} units sold at POS
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Package revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.revenueSplit.packages)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.revenueSplit.packageQty} packages sold
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Inventory item sales</CardTitle>
              <CardDescription>
                Every product sold at POS in this period — retail, cost, COGS, and profit per item
              </CardDescription>
            </div>
            {report.productSaleRows.length > 0 && (
              <Badge className="bg-primary">
                {report.productSaleRows.length} product{report.productSaleRows.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {report.productSaleRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">No inventory sales in this period</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Sell a product at{" "}
                <a href="/pos" className="text-primary hover:underline">
                  POS
                </a>{" "}
                and it will appear here. Try &quot;Today&quot; if you just made a sale.
              </p>
            </div>
          ) : (
            <PaginatedList items={report.productSaleRows}>
              {(slice) => (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit cost</TableHead>
                        <TableHead className="text-right">Unit retail</TableHead>
                        <TableHead className="text-right">Retail total</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice.map((row) => (
                        <TableRow key={row.productId}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.sku ?? "—"}</TableCell>
                          <TableCell className="text-right">{row.qtySold}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(row.unitCost)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.unitRetail)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.retailRevenue)}
                          </TableCell>
                          <TableCell className="text-right text-orange-700">
                            {formatCurrency(row.costOfGoodsSold)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-700">
                            {formatCurrency(row.grossProfit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.marginPercent >= 30 ? "default" : "secondary"}>
                              {row.marginPercent}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right">{report.productSales.unitsSold}</TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right">
                          {formatCurrency(report.productSales.retailRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-orange-700">
                          {formatCurrency(report.productSales.costOfGoodsSold)}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {formatCurrency(report.productSales.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">{report.productSales.marginPercent}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </PaginatedList>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Product sales in period</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Retail sold</p>
            <p className="font-semibold">{formatCurrency(report.productSales.retailRevenue)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">COGS (cost × qty sold)</p>
            <p className="font-semibold text-orange-700">
              {formatCurrency(report.productSales.costOfGoodsSold)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Gross profit</p>
            <p className="font-semibold text-green-700">
              {formatCurrency(report.productSales.grossProfit)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Revenue by day</CardTitle></CardHeader>
        <CardContent>
          {report.revenueByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <PaginatedList items={report.revenueByDay}>
              {(slice) => (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice.map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PaginatedList>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top services</CardTitle>
          <CardDescription>By revenue in selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {report.topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service sales in this period.</p>
          ) : (
            <ItemTable items={report.topServices} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top products (quick view)</CardTitle>
          <CardDescription>Same data as inventory table above, sorted by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {report.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product sales in this period.</p>
          ) : (
            <ItemTable items={report.topProducts} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All top items</CardTitle>
          <CardDescription>Services, products, and packages combined</CardDescription>
        </CardHeader>
        <CardContent>
          {report.topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <PaginatedList items={report.topItems}>
              {(slice) => (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Qty sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice.map((item) => (
                        <TableRow key={`${item.itemType}-${item.name}`}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.itemType ?? "—"}</TableCell>
                          <TableCell>{item.qty}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PaginatedList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemTable({ items }: { items: { name: string; qty: number; revenue: number }[] }) {
  return (
    <PaginatedList items={items}>
      {(slice) => (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((item) => (
                <TableRow key={item.name}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}
