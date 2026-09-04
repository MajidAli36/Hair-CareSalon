"use server";

import { getInventoryMoneySnapshot, getProductSalesBreakdown } from "@/lib/inventory/sales-metrics";
import { createReportContext, getSupabase } from "@/lib/reports/context";
import { cmp } from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type StockProductRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  lowThreshold: number;
  cost: number;
  retail: number;
  valueAtCost: number;
  valueAtRetail: number;
  status: "ok" | "low" | "out" | "dead";
};

export type InventoryTxnRow = {
  id: string;
  createdAt: string;
  productName: string;
  type: string;
  quantity: number;
  referenceType: string | null;
};

export type InventoryReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    valueAtCost: CompareResult;
    valueAtRetail: CompareResult;
    potentialProfit: CompareResult;
    unitsSold: CompareResult;
    lowStock: CompareResult;
    outOfStock: CompareResult;
    productCogs: CompareResult;
    productGrossProfit: CompareResult;
  };
  products: StockProductRow[];
  movements: { name: string; value: number }[];
  transactions: InventoryTxnRow[];
  notes: string[];
};

export async function getInventoryReport(from?: string, to?: string): Promise<InventoryReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [snapshot, prevSnapshot, { data: products }, { data: txns }, soldBreakdown] =
    await Promise.all([
    getInventoryMoneySnapshot(ctx.organizationId, ctx.from, ctx.to),
    getInventoryMoneySnapshot(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
    supabase
      .from("products")
      .select("id, name, sku, stock_quantity, low_stock_threshold, cost_price, retail_price, is_active")
      .eq("organization_id", ctx.organizationId),
    supabase
      .from("inventory_transactions")
      .select("id, created_at, type, quantity, reference_type, product_id, product:products(name)")
      .eq("organization_id", ctx.organizationId)
      .gte("created_at", ctx.start.toISOString())
      .lte("created_at", ctx.end.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    getProductSalesBreakdown(ctx.organizationId, ctx.from, ctx.to),
  ]);

  const soldIds = new Set(soldBreakdown.map((p) => p.productId));

  const rows: StockProductRow[] = (products ?? [])
    .filter((p) => p.is_active)
    .map((p) => {
      const stock = Number(p.stock_quantity) || 0;
      const low = Number(p.low_stock_threshold) || 0;
      const cost = Number(p.cost_price) || 0;
      const retail = Number(p.retail_price) || 0;
      let status: StockProductRow["status"] = "ok";
      if (stock <= 0) status = "out";
      else if (stock <= low) status = "low";
      else if (!soldIds.has(p.id) && stock > 0) status = "dead";
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock,
        lowThreshold: low,
        cost,
        retail,
        valueAtCost: stock * cost,
        valueAtRetail: stock * retail,
        status,
      };
    });

  const lowStock = rows.filter((r) => r.status === "low").length;
  const outOfStock = rows.filter((r) => r.status === "out").length;

  const move = { IN: 0, OUT: 0, ADJUSTMENT: 0 };
  for (const t of txns ?? []) {
    const qty = Number(t.quantity) || 0;
    if (t.type === "IN") move.IN += qty;
    else if (t.type === "OUT") move.OUT += qty;
    else move.ADJUSTMENT += qty;
  }

  const transactions: InventoryTxnRow[] = (txns ?? []).map((t) => {
    const prod = t.product as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(prod) ? prod[0]?.name : prod?.name;
    return {
      id: t.id,
      createdAt: t.created_at,
      productName: name ?? "Product",
      type: t.type,
      quantity: Number(t.quantity) || 0,
      referenceType: t.reference_type,
    };
  });

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      valueAtCost: cmp(snapshot.inventoryValueAtCost, prevSnapshot.inventoryValueAtCost),
      valueAtRetail: cmp(snapshot.inventoryValueAtRetail, prevSnapshot.inventoryValueAtRetail),
      potentialProfit: cmp(snapshot.potentialProfitOnHand, prevSnapshot.potentialProfitOnHand),
      unitsSold: cmp(snapshot.productSales.unitsSold, prevSnapshot.productSales.unitsSold),
      lowStock: cmp(lowStock, lowStock),
      outOfStock: cmp(outOfStock, outOfStock),
      productCogs: cmp(
        snapshot.productSales.costOfGoodsSold,
        prevSnapshot.productSales.costOfGoodsSold
      ),
      productGrossProfit: cmp(
        snapshot.productSales.grossProfit,
        prevSnapshot.productSales.grossProfit
      ),
    },
    products: rows,
    movements: [
      { name: "Stock In", value: move.IN },
      { name: "Stock Out", value: move.OUT },
      { name: "Adjustments", value: move.ADJUSTMENT },
    ],
    transactions,
    notes: [
      "On-hand valuation uses current catalog cost/retail × stock quantity.",
      "Dead stock = active products with on-hand qty and zero sales in the selected period.",
      "Suppliers and purchase orders are not tracked in this system.",
    ],
  };
}
