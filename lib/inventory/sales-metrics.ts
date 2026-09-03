import { createClient } from "@/lib/supabase/server";
import { parseLocalDateRange } from "@/lib/dates/local";
import { getInventorySummary } from "@/lib/inventory/valuation";

export type ProductSalesMetrics = {
  unitsSold: number;
  retailRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  marginPercent: number;
};

export type InventoryMoneySnapshot = {
  inventoryValueAtCost: number;
  inventoryValueAtRetail: number;
  potentialProfitOnHand: number;
  totalUnitsOnHand: number;
  productSales: ProductSalesMetrics;
};

export type ProductSaleRow = {
  productId: string;
  name: string;
  sku: string | null;
  qtySold: number;
  retailRevenue: number;
  unitRetail: number;
  unitCost: number;
  costOfGoodsSold: number;
  grossProfit: number;
  marginPercent: number;
};

export type RevenueSplit = {
  services: number;
  products: number;
  packages: number;
  serviceQty: number;
  productQty: number;
  packageQty: number;
};

/** Per-product sales breakdown for reports (completed POS sales in range). */
export async function getProductSalesBreakdown(
  organizationId: string,
  from?: string,
  to?: string
): Promise<ProductSaleRow[]> {
  const supabase = await createClient();
  const { start, end } = parseLocalDateRange(from, to);

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "COMPLETED")
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  const saleIds = (sales ?? []).map((s) => s.id);
  if (!saleIds.length) return [];

  const { data: lines } = await supabase
    .from("sale_items")
    .select("item_id, name, quantity, line_total, unit_price")
    .eq("organization_id", organizationId)
    .eq("item_type", "PRODUCT")
    .in("sale_id", saleIds);

  if (!lines?.length) return [];

  const productIds = [...new Set(lines.map((l) => l.item_id))];
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, cost_price, retail_price")
    .eq("organization_id", organizationId)
    .in("id", productIds);

  const productMap = new Map(
    (products ?? []).map((p) => [
      p.id,
      {
        name: p.name,
        sku: p.sku,
        cost: Number(p.cost_price) || 0,
        retail: Number(p.retail_price) || 0,
      },
    ])
  );

  const agg = new Map<
    string,
    { name: string; sku: string | null; qty: number; revenue: number; unitRetail: number }
  >();

  for (const line of lines) {
    const meta = productMap.get(line.item_id);
    const existing = agg.get(line.item_id);
    const qty = Number(line.quantity) || 0;
    const revenue = Number(line.line_total) || 0;
    const unitRetail = Number(line.unit_price) || 0;

    if (existing) {
      existing.qty += qty;
      existing.revenue += revenue;
    } else {
      agg.set(line.item_id, {
        name: meta?.name ?? line.name,
        sku: meta?.sku ?? null,
        qty,
        revenue,
        unitRetail: unitRetail || meta?.retail || 0,
      });
    }
  }

  return [...agg.entries()]
    .map(([productId, row]) => {
      const unitCost = productMap.get(productId)?.cost ?? 0;
      const cogs = row.qty * unitCost;
      const profit = row.revenue - cogs;
      const marginPercent = row.revenue > 0 ? Math.round((profit / row.revenue) * 100) : 0;
      return {
        productId,
        name: row.name,
        sku: row.sku,
        qtySold: row.qty,
        retailRevenue: row.revenue,
        unitRetail: row.unitRetail,
        unitCost,
        costOfGoodsSold: cogs,
        grossProfit: profit,
        marginPercent,
      };
    })
    .sort((a, b) => b.retailRevenue - a.retailRevenue);
}

/** Revenue split by sale line type for the selected period. */
export async function getRevenueSplit(
  organizationId: string,
  from?: string,
  to?: string
): Promise<RevenueSplit> {
  const supabase = await createClient();
  const { start, end } = parseLocalDateRange(from, to);

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "COMPLETED")
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  const saleIds = (sales ?? []).map((s) => s.id);
  const empty: RevenueSplit = {
    services: 0,
    products: 0,
    packages: 0,
    serviceQty: 0,
    productQty: 0,
    packageQty: 0,
  };
  if (!saleIds.length) return empty;

  const { data: lines } = await supabase
    .from("sale_items")
    .select("item_type, line_total, quantity")
    .eq("organization_id", organizationId)
    .in("sale_id", saleIds);

  const split = { ...empty };
  for (const line of lines ?? []) {
    const revenue = Number(line.line_total) || 0;
    const qty = Number(line.quantity) || 0;
    if (line.item_type === "SERVICE") {
      split.services += revenue;
      split.serviceQty += qty;
    } else if (line.item_type === "PRODUCT") {
      split.products += revenue;
      split.productQty += qty;
    } else if (line.item_type === "PACKAGE") {
      split.packages += revenue;
      split.packageQty += qty;
    }
  }
  return split;
}

/** COGS & product revenue from completed POS sales in a date range. */
export async function getProductSalesMetrics(
  organizationId: string,
  from?: string,
  to?: string
): Promise<ProductSalesMetrics> {
  const supabase = await createClient();
  const { start, end } = parseLocalDateRange(from, to);

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "COMPLETED")
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  const saleIds = (sales ?? []).map((s) => s.id);
  if (!saleIds.length) {
    return {
      unitsSold: 0,
      retailRevenue: 0,
      costOfGoodsSold: 0,
      grossProfit: 0,
      marginPercent: 0,
    };
  }

  const { data: lines } = await supabase
    .from("sale_items")
    .select("item_id, quantity, line_total")
    .eq("organization_id", organizationId)
    .eq("item_type", "PRODUCT")
    .in("sale_id", saleIds);

  if (!lines?.length) {
    return {
      unitsSold: 0,
      retailRevenue: 0,
      costOfGoodsSold: 0,
      grossProfit: 0,
      marginPercent: 0,
    };
  }

  const productIds = [...new Set(lines.map((l) => l.item_id))];
  const { data: products } = await supabase
    .from("products")
    .select("id, cost_price")
    .eq("organization_id", organizationId)
    .in("id", productIds);

  const costMap = new Map(
    (products ?? []).map((p) => [p.id, Number(p.cost_price) || 0])
  );

  let unitsSold = 0;
  let retailRevenue = 0;
  let costOfGoodsSold = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const revenue = Number(line.line_total) || 0;
    const cost = costMap.get(line.item_id) ?? 0;
    unitsSold += qty;
    retailRevenue += revenue;
    costOfGoodsSold += qty * cost;
  }

  const grossProfit = retailRevenue - costOfGoodsSold;
  const marginPercent =
    retailRevenue > 0 ? Math.round((grossProfit / retailRevenue) * 100) : 0;

  return {
    unitsSold,
    retailRevenue,
    costOfGoodsSold,
    grossProfit,
    marginPercent,
  };
}

export async function getInventoryMoneySnapshot(
  organizationId: string,
  from?: string,
  to?: string
): Promise<InventoryMoneySnapshot> {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("cost_price, retail_price, stock_quantity, low_stock_threshold, is_active")
    .eq("organization_id", organizationId);

  const summary = getInventorySummary(products ?? []);
  const productSales = await getProductSalesMetrics(organizationId, from, to);

  return {
    inventoryValueAtCost: summary.totalValueAtCost,
    inventoryValueAtRetail: summary.totalValueAtRetail,
    potentialProfitOnHand: summary.totalPotentialProfit,
    totalUnitsOnHand: summary.totalUnits,
    productSales,
  };
}
