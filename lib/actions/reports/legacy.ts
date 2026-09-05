"use server";

import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { parseLocalDateRange, isoToLocalDateString } from "@/lib/dates/local";
import { roundMoney } from "@/lib/sales/calculate";
import {
  getInventoryMoneySnapshot,
  getProductSalesBreakdown,
  getRevenueSplit,
  type ProductSaleRow,
} from "@/lib/inventory/sales-metrics";

export type ReportsData = {
  totalRevenue: number;
  saleCount: number;
  revenueByDay: { date: string; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number; itemType?: string }[];
  topServices: { name: string; qty: number; revenue: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  productSaleRows: ProductSaleRow[];
  revenueSplit: {
    services: number;
    products: number;
    packages: number;
    serviceQty: number;
    productQty: number;
    packageQty: number;
  };
  productSales: {
    unitsSold: number;
    retailRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    marginPercent: number;
  };
  inventoryOnHand: {
    valueAtCost: number;
    valueAtRetail: number;
    totalUnits: number;
  };
  periodLabel: string;
};

export async function getReportsForRange(
  from?: string,
  to?: string
): Promise<ReportsData> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { start, end, fromLabel, toLabel } = parseLocalDateRange(from, to);

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, total, completed_at")
    .eq("organization_id", org.organizationId)
    .in("status", ["COMPLETED", "AMENDED"])
    .is("deleted_at", null)
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  if (salesError) throw new Error(salesError.message);

  const saleList = sales ?? [];
  const saleIds = saleList.map((s) => s.id);

  let items: { name: string; item_type: string; line_total: number; quantity: number }[] = [];
  if (saleIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("name, item_type, line_total, quantity")
      .eq("organization_id", org.organizationId)
      .in("sale_id", saleIds);
    items = itemsData ?? [];
  }

  const totalRevenue = roundMoney(
    saleList.reduce((sum, s) => sum + Number(s.total), 0)
  );
  const saleCount = saleList.length;

  const revenueByDay: Record<string, number> = {};
  for (const sale of saleList) {
    if (!sale.completed_at) continue;
    const day = isoToLocalDateString(sale.completed_at);
    revenueByDay[day] = roundMoney((revenueByDay[day] ?? 0) + Number(sale.total));
  }

  const topItemsMap: Record<string, { name: string; qty: number; revenue: number; itemType: string }> = {};
  for (const item of items) {
    const key = `${item.item_type}:${item.name}`;
    if (!topItemsMap[key]) {
      topItemsMap[key] = { name: item.name, qty: 0, revenue: 0, itemType: item.item_type };
    }
    topItemsMap[key].qty += item.quantity;
    topItemsMap[key].revenue = roundMoney(
      topItemsMap[key].revenue + Number(item.line_total)
    );
  }

  const allItems = Object.values(topItemsMap).sort((a, b) => b.revenue - a.revenue);
  const topServices = allItems.filter((i) => i.itemType === "SERVICE").slice(0, 10);
  const topProducts = allItems.filter((i) => i.itemType === "PRODUCT").slice(0, 10);

  const inventory = await getInventoryMoneySnapshot(org.organizationId, fromLabel, toLabel);
  const [productSaleRows, revenueSplit] = await Promise.all([
    getProductSalesBreakdown(org.organizationId, fromLabel, toLabel),
    getRevenueSplit(org.organizationId, fromLabel, toLabel),
  ]);

  return {
    totalRevenue,
    saleCount,
    revenueByDay: Object.entries(revenueByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue })),
    topItems: allItems.slice(0, 10).map(({ itemType, ...rest }) => ({ ...rest, itemType })),
    topServices,
    topProducts,
    productSaleRows,
    revenueSplit,
    productSales: inventory.productSales,
    inventoryOnHand: {
      valueAtCost: inventory.inventoryValueAtCost,
      valueAtRetail: inventory.inventoryValueAtRetail,
      totalUnits: inventory.totalUnitsOnHand,
    },
    periodLabel: fromLabel === toLabel ? fromLabel : `${fromLabel} → ${toLabel}`,
  };
}

/** @deprecated Use getReportsForRange — defaults to last 30 days */
export async function getReportsSummary() {
  return getReportsForRange();
}
