"use server";

import { isoToLocalDateString } from "@/lib/dates/local";
import {
  getInventoryMoneySnapshot,
  getRevenueSplit,
} from "@/lib/inventory/sales-metrics";
import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  fetchSaleItems,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type OverallReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    totalRevenue: CompareResult;
    netRevenue: CompareResult;
    saleCount: CompareResult;
    aov: CompareResult;
    serviceRevenue: CompareResult;
    productRevenue: CompareResult;
    packageRevenue: CompareResult;
    discounts: CompareResult;
    depositRefunds: CompareResult;
    productGrossProfit: CompareResult;
  };
  revenueByDay: { label: string; value: number }[];
  revenueSplit: { name: string; value: number }[];
  topServices: { name: string; qty: number; revenue: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  notes: string[];
};

export async function getOverallReport(from?: string, to?: string): Promise<OverallReport> {
  const ctx = await createReportContext(from, to);
  const [curSales, prevSales] = await Promise.all([
    fetchCompletedSales(ctx, "current"),
    fetchCompletedSales(ctx, "previous"),
  ]);

  const curIds = curSales.map((s) => s.id);
  const prevIds = prevSales.map((s) => s.id);
  const [curItems, prevItems, curSplit, prevSplit, inventory, prevInventory, refundsCur, refundsPrev] =
    await Promise.all([
      fetchSaleItems(ctx.organizationId, curIds),
      fetchSaleItems(ctx.organizationId, prevIds),
      getRevenueSplit(ctx.organizationId, ctx.from, ctx.to),
      getRevenueSplit(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
      getInventoryMoneySnapshot(ctx.organizationId, ctx.from, ctx.to),
      getInventoryMoneySnapshot(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
      fetchDepositRefunds(ctx.organizationId, ctx.start, ctx.end),
      fetchDepositRefunds(ctx.organizationId, ctx.prevStart, ctx.prevEnd),
    ]);

  const sum = (rows: { total: number }[]) => rows.reduce((a, s) => a + s.total, 0);
  const sumDisc = (rows: { discount: number }[]) => rows.reduce((a, s) => a + s.discount, 0);

  const totalRevenue = sum(curSales);
  const prevRevenue = sum(prevSales);
  const discounts = sumDisc(curSales);
  const prevDiscounts = sumDisc(prevSales);
  const saleCount = curSales.length;
  const prevSaleCount = prevSales.length;
  const aov = saleCount ? totalRevenue / saleCount : 0;
  const prevAov = prevSaleCount ? prevRevenue / prevSaleCount : 0;

  // Net revenue ≈ ticket total (already after discount + tax). Discounts shown separately.
  const netRevenue = totalRevenue;
  const prevNet = prevRevenue;

  const byDay: Record<string, number> = {};
  for (const s of curSales) {
    if (!s.completed_at) continue;
    const day = isoToLocalDateString(s.completed_at);
    byDay[day] = (byDay[day] ?? 0) + s.total;
  }

  const serviceAgg = aggregateByName(curItems.filter((i) => i.item_type === "SERVICE"));
  const productAgg = aggregateByName(curItems.filter((i) => i.item_type === "PRODUCT"));

  void prevItems; // reserved for future mix comparisons

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalRevenue: cmp(totalRevenue, prevRevenue),
      netRevenue: cmp(netRevenue, prevNet),
      saleCount: cmp(saleCount, prevSaleCount),
      aov: cmp(aov, prevAov),
      serviceRevenue: cmp(curSplit.services, prevSplit.services),
      productRevenue: cmp(curSplit.products, prevSplit.products),
      packageRevenue: cmp(curSplit.packages, prevSplit.packages),
      discounts: cmp(discounts, prevDiscounts),
      depositRefunds: cmp(refundsCur, refundsPrev),
      productGrossProfit: cmp(
        inventory.productSales.grossProfit,
        prevInventory.productSales.grossProfit
      ),
    },
    revenueByDay: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value })),
    revenueSplit: [
      { name: "Services", value: curSplit.services },
      { name: "Products", value: curSplit.products },
      { name: "Packages", value: curSplit.packages },
    ],
    topServices: serviceAgg.slice(0, 10),
    topProducts: productAgg.slice(0, 10),
    notes: [
      "Ticket revenue uses completed sale totals (after discount, including tax).",
      "Service / product / package mix uses line totals before sale-level discount allocation.",
      "Gross profit is product COGS only — services and packages have no cost model.",
      "Refunds shown are appointment deposit refunds (no sale-level refund table).",
    ],
  };
}

function aggregateByName(
  items: { name: string; quantity: number; line_total: number }[]
) {
  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const item of items) {
    const cur = map.get(item.name) ?? { name: item.name, qty: 0, revenue: 0 };
    cur.qty += item.quantity;
    cur.revenue += item.line_total;
    map.set(item.name, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

async function fetchDepositRefunds(organizationId: string, start: Date, end: Date) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_deposits")
    .select("amount")
    .eq("organization_id", organizationId)
    .eq("status", "REFUNDED")
    .gte("refunded_at", start.toISOString())
    .lte("refunded_at", end.toISOString());
  return (data ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
}
