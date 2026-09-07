import { createClient } from "@/lib/supabase/server";
import { parseLocalDateRange } from "@/lib/dates/local";
import { getInventorySummary } from "@/lib/inventory/valuation";

export type ProductSalesMetrics = {
  /** Retail product units sold to customers */
  unitsSold: number;
  /** Units consumed inside services (salon / backbar use) */
  unitsSalonUsed: number;
  retailRevenue: number;
  /** Retail COGS + salon-use COGS */
  costOfGoodsSold: number;
  salonCostOfGoodsSold: number;
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
  /** Retail units sold on POS product lines */
  qtySold: number;
  /** Units used inside services (not billed as product lines) */
  qtySalonUsed: number;
  retailRevenue: number;
  unitRetail: number;
  unitCost: number;
  /** Retail + salon use cost */
  costOfGoodsSold: number;
  salonCostOfGoodsSold: number;
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
    .in("status", ["COMPLETED", "AMENDED"])
    .is("deleted_at", null)
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  const saleIds = (sales ?? []).map((s) => s.id);
  if (!saleIds.length) return [];

  const [{ data: lines }, { data: salonUsages }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("item_id, name, quantity, line_total, unit_price, unit_cost")
      .eq("organization_id", organizationId)
      .eq("item_type", "PRODUCT")
      .in("sale_id", saleIds),
    supabase
      .from("sale_consumable_usages")
      .select("product_id, quantity, unit_cost")
      .eq("organization_id", organizationId)
      .in("sale_id", saleIds),
  ]);

  if (!lines?.length && !salonUsages?.length) return [];

  const productIds = [
    ...new Set([
      ...(lines ?? []).map((l) => l.item_id),
      ...(salonUsages ?? []).map((u) => u.product_id),
    ]),
  ];
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
    {
      name: string;
      sku: string | null;
      qty: number;
      qtySalon: number;
      revenue: number;
      unitRetail: number;
      cogs: number;
      salonCogs: number;
    }
  >();

  function ensure(productId: string, fallbackName?: string) {
    let existing = agg.get(productId);
    if (existing) return existing;
    const meta = productMap.get(productId);
    existing = {
      name: meta?.name ?? fallbackName ?? "Product",
      sku: meta?.sku ?? null,
      qty: 0,
      qtySalon: 0,
      revenue: 0,
      unitRetail: meta?.retail ?? 0,
      cogs: 0,
      salonCogs: 0,
    };
    agg.set(productId, existing);
    return existing;
  }

  for (const line of lines ?? []) {
    const meta = productMap.get(line.item_id);
    const existing = ensure(line.item_id, line.name);
    const qty = Number(line.quantity) || 0;
    const revenue = Number(line.line_total) || 0;
    const unitRetail = Number(line.unit_price) || 0;
    const unitCost =
      line.unit_cost != null && Number(line.unit_cost) >= 0
        ? Number(line.unit_cost)
        : meta?.cost ?? 0;
    existing.qty += qty;
    existing.revenue += revenue;
    existing.cogs += qty * unitCost;
    if (unitRetail) existing.unitRetail = unitRetail;
  }

  for (const usage of salonUsages ?? []) {
    const meta = productMap.get(usage.product_id);
    const existing = ensure(usage.product_id);
    const qty = Math.floor(Number(usage.quantity) || 0);
    const unitCost =
      usage.unit_cost != null && Number(usage.unit_cost) >= 0
        ? Number(usage.unit_cost)
        : meta?.cost ?? 0;
    existing.qtySalon += qty;
    existing.salonCogs += qty * unitCost;
  }

  return [...agg.entries()]
    .map(([productId, row]) => {
      const totalUnits = row.qty + row.qtySalon;
      const totalCogs = row.cogs + row.salonCogs;
      const unitCost = totalUnits > 0 ? totalCogs / totalUnits : 0;
      const profit = row.revenue - totalCogs;
      const marginPercent = row.revenue > 0 ? Math.round((profit / row.revenue) * 100) : 0;
      return {
        productId,
        name: row.name,
        sku: row.sku,
        qtySold: row.qty,
        qtySalonUsed: row.qtySalon,
        retailRevenue: row.revenue,
        unitRetail: row.unitRetail,
        unitCost,
        costOfGoodsSold: totalCogs,
        salonCostOfGoodsSold: row.salonCogs,
        grossProfit: profit,
        marginPercent,
      };
    })
    .sort((a, b) => b.retailRevenue - a.retailRevenue || b.costOfGoodsSold - a.costOfGoodsSold);
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
    .in("status", ["COMPLETED", "AMENDED"])
    .is("deleted_at", null)
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
  const empty: ProductSalesMetrics = {
    unitsSold: 0,
    unitsSalonUsed: 0,
    retailRevenue: 0,
    costOfGoodsSold: 0,
    salonCostOfGoodsSold: 0,
    grossProfit: 0,
    marginPercent: 0,
  };

  const supabase = await createClient();
  const { start, end } = parseLocalDateRange(from, to);

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("organization_id", organizationId)
    .in("status", ["COMPLETED", "AMENDED"])
    .is("deleted_at", null)
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  const saleIds = (sales ?? []).map((s) => s.id);
  if (!saleIds.length) return empty;

  const [{ data: lines }, { data: salonUsages }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("item_id, quantity, line_total, unit_cost")
      .eq("organization_id", organizationId)
      .eq("item_type", "PRODUCT")
      .in("sale_id", saleIds),
    supabase
      .from("sale_consumable_usages")
      .select("product_id, quantity, unit_cost")
      .eq("organization_id", organizationId)
      .in("sale_id", saleIds),
  ]);

  const productIds = [
    ...new Set([
      ...(lines ?? []).map((l) => l.item_id),
      ...(salonUsages ?? []).map((u) => u.product_id),
    ]),
  ];
  const costMap = new Map<string, number>();
  if (productIds.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id, cost_price")
      .eq("organization_id", organizationId)
      .in("id", productIds);
    for (const p of products ?? []) {
      costMap.set(p.id, Number(p.cost_price) || 0);
    }
  }

  let unitsSold = 0;
  let unitsSalonUsed = 0;
  let retailRevenue = 0;
  let retailCogs = 0;
  let salonCostOfGoodsSold = 0;

  for (const line of lines ?? []) {
    const qty = Number(line.quantity) || 0;
    const revenue = Number(line.line_total) || 0;
    const unitCost =
      line.unit_cost != null && Number(line.unit_cost) >= 0
        ? Number(line.unit_cost)
        : costMap.get(line.item_id) ?? 0;
    unitsSold += qty;
    retailRevenue += revenue;
    retailCogs += qty * unitCost;
  }

  for (const usage of salonUsages ?? []) {
    const qty = Math.floor(Number(usage.quantity) || 0);
    const unitCost =
      usage.unit_cost != null && Number(usage.unit_cost) >= 0
        ? Number(usage.unit_cost)
        : costMap.get(usage.product_id) ?? 0;
    unitsSalonUsed += qty;
    salonCostOfGoodsSold += qty * unitCost;
  }

  const costOfGoodsSold = retailCogs + salonCostOfGoodsSold;
  const grossProfit = retailRevenue - costOfGoodsSold;
  const marginPercent =
    retailRevenue > 0 ? Math.round((grossProfit / retailRevenue) * 100) : 0;

  return {
    unitsSold,
    unitsSalonUsed,
    retailRevenue,
    costOfGoodsSold,
    salonCostOfGoodsSold,
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
