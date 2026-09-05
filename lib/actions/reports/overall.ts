"use server";

import { isoToLocalDateString } from "@/lib/dates/local";
import { roundMoney } from "@/lib/sales/calculate";
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
  const [
    curItems,
    prevItems,
    curSplit,
    prevSplit,
    inventory,
    prevInventory,
    refundsCur,
    refundsPrev,
    saleRefundsCur,
    saleRefundsPrev,
  ] = await Promise.all([
      fetchSaleItems(ctx.organizationId, curIds),
      fetchSaleItems(ctx.organizationId, prevIds),
      getRevenueSplit(ctx.organizationId, ctx.from, ctx.to),
      getRevenueSplit(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
      getInventoryMoneySnapshot(ctx.organizationId, ctx.from, ctx.to),
      getInventoryMoneySnapshot(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
      fetchDepositRefunds(ctx.organizationId, ctx.start, ctx.end),
      fetchDepositRefunds(ctx.organizationId, ctx.prevStart, ctx.prevEnd),
      fetchSaleRefunds(ctx.organizationId, ctx.start, ctx.end, curIds),
      fetchSaleRefunds(ctx.organizationId, ctx.prevStart, ctx.prevEnd, prevIds),
    ]);

  const sum = (rows: { total: number }[]) =>
    roundMoney(rows.reduce((a, s) => a + s.total, 0));
  const sumDisc = (rows: { discount: number }[]) =>
    roundMoney(rows.reduce((a, s) => a + s.discount, 0));

  const totalRevenue = sum(curSales);
  const prevRevenue = sum(prevSales);
  const discounts = sumDisc(curSales);
  const prevDiscounts = sumDisc(prevSales);
  const saleCount = curSales.length;
  const prevSaleCount = prevSales.length;
  const aov = saleCount ? roundMoney(totalRevenue / saleCount) : 0;
  const prevAov = prevSaleCount ? roundMoney(prevRevenue / prevSaleCount) : 0;

  // Ticket revenue minus partial refunds on still-posted sales (full void/refund already drops tickets)
  const netRevenue = roundMoney(totalRevenue - saleRefundsCur);
  const prevNet = roundMoney(prevRevenue - saleRefundsPrev);

  const byDay: Record<string, number> = {};
  for (const s of curSales) {
    if (!s.completed_at) continue;
    const day = isoToLocalDateString(s.completed_at);
    byDay[day] = roundMoney((byDay[day] ?? 0) + s.total);
  }

  const serviceAgg = aggregateByName(curItems.filter((i) => i.item_type === "SERVICE"));
  const productAgg = aggregateByName(curItems.filter((i) => i.item_type === "PRODUCT"));

  void prevItems;

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
      "Ticket revenue uses completed/amended sale totals (after discount, including tax).",
      "Net revenue = ticket revenue − partial sale refunds on those same tickets (full void/refund already removes the ticket).",
      "Service / product / package mix uses line totals (before sale-level discount allocation).",
      "Gross profit is product COGS only — services and packages have no cost model.",
      "Deposit refunds are appointment advances returned to customers.",
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
    cur.revenue = roundMoney(cur.revenue + item.line_total);
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
  return roundMoney((data ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0));
}

async function fetchSaleRefunds(
  organizationId: string,
  start: Date,
  end: Date,
  postedSaleIds: string[]
) {
  if (!postedSaleIds.length) return 0;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let total = 0;
  for (let i = 0; i < postedSaleIds.length; i += 200) {
    const chunk = postedSaleIds.slice(i, i + 200);
    const { data } = await supabase
      .from("sale_refunds")
      .select("amount")
      .eq("organization_id", organizationId)
      .in("sale_id", chunk)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());
    total = roundMoney(
      total + (data ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0)
    );
  }
  return total;
}
