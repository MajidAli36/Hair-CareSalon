"use server";

import {
  getProductSalesBreakdown,
  getProductSalesMetrics,
} from "@/lib/inventory/sales-metrics";
import { cmp, createReportContext, getSupabase } from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";
import { roundMoney } from "@/lib/sales/calculate";

export type ProductUsageKind = "RETAIL" | "SALON" | "BOTH";

export type ProductReportRow = {
  productId: string;
  name: string;
  sku: string | null;
  category: string | null;
  usageKind: ProductUsageKind;
  qtySold: number;
  qtySalonUsed: number;
  revenue: number;
  /** Retail line COGS only */
  retailCogs: number;
  cogs: number;
  salonCogs: number;
  profit: number;
  marginPercent: number;
  currentStock: number;
  belowCost: boolean;
};

export type SalonUseByServiceRow = {
  serviceId: string;
  serviceName: string;
  tickets: number;
  productLines: number;
  unitsUsed: number;
  salonCogs: number;
};

export type ProductsReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    revenue: CompareResult;
    unitsSold: CompareResult;
    unitsSalonUsed: CompareResult;
    cogs: CompareResult;
    salonCogs: CompareResult;
    retailCogs: CompareResult;
    grossProfit: CompareResult;
    margin: CompareResult;
    belowCostCount: CompareResult;
  };
  catalogCounts: {
    retail: number;
    salon: number;
    both: number;
    total: number;
  };
  top10: ProductReportRow[];
  bottom10: ProductReportRow[];
  byCategory: { name: string; value: number }[];
  /** Full combined detail */
  detail: ProductReportRow[];
  /** Customer POS product lines in period */
  retailRows: ProductReportRow[];
  /** Products consumed inside services in period */
  salonRows: ProductReportRow[];
  salonByService: SalonUseByServiceRow[];
  notes: string[];
};

export async function getProductsReport(from?: string, to?: string): Promise<ProductsReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [curRows, prevRows, prevMetrics, curMetrics, { data: catalog }] = await Promise.all([
    getProductSalesBreakdown(ctx.organizationId, ctx.from, ctx.to),
    getProductSalesBreakdown(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
    getProductSalesMetrics(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
    getProductSalesMetrics(ctx.organizationId, ctx.from, ctx.to),
    supabase
      .from("products")
      .select("id, usage_kind")
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null),
  ]);

  const catalogCounts = { retail: 0, salon: 0, both: 0, total: 0 };
  for (const p of catalog ?? []) {
    catalogCounts.total += 1;
    const kind = (p.usage_kind as ProductUsageKind | null) ?? "BOTH";
    if (kind === "RETAIL") catalogCounts.retail += 1;
    else if (kind === "SALON") catalogCounts.salon += 1;
    else catalogCounts.both += 1;
  }

  const productIds = curRows.map((r) => r.productId);
  const meta = new Map<
    string,
    { category: string | null; stock: number; usageKind: ProductUsageKind }
  >();
  if (productIds.length) {
    const { data } = await supabase
      .from("products")
      .select("id, stock_quantity, usage_kind, category:product_categories(name)")
      .eq("organization_id", ctx.organizationId)
      .in("id", productIds);
    for (const p of data ?? []) {
      const cat = p.category as unknown as { name: string } | { name: string }[] | null;
      const category = Array.isArray(cat) ? cat[0]?.name ?? null : cat?.name ?? null;
      meta.set(p.id, {
        category,
        stock: Number(p.stock_quantity) || 0,
        usageKind: (p.usage_kind as ProductUsageKind | null) ?? "BOTH",
      });
    }
  }

  const detail: ProductReportRow[] = curRows.map((r) => {
    const m = meta.get(r.productId);
    const retailCogs = roundMoney(r.costOfGoodsSold - r.salonCostOfGoodsSold);
    return {
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      category: m?.category ?? null,
      usageKind: m?.usageKind ?? "BOTH",
      qtySold: r.qtySold,
      qtySalonUsed: r.qtySalonUsed,
      revenue: r.retailRevenue,
      retailCogs,
      cogs: r.costOfGoodsSold,
      salonCogs: r.salonCostOfGoodsSold,
      profit: r.grossProfit,
      marginPercent: r.marginPercent,
      currentStock: m?.stock ?? 0,
      belowCost: r.grossProfit < 0,
    };
  });

  const retailRows = detail.filter((d) => d.qtySold > 0);
  const salonRows = detail
    .filter((d) => d.qtySalonUsed > 0)
    .sort((a, b) => b.salonCogs - a.salonCogs);

  const belowCostCount = detail.filter((d) => d.belowCost).length;
  const prevBelowCostCount = prevRows.filter((r) => r.grossProfit < 0).length;
  const catMap: Record<string, number> = {};
  for (const row of retailRows) {
    const key = row.category ?? "Uncategorized";
    catMap[key] = (catMap[key] ?? 0) + row.revenue;
  }

  const prevRetailCogs = roundMoney(
    prevMetrics.costOfGoodsSold - prevMetrics.salonCostOfGoodsSold
  );
  const curRetailCogs = roundMoney(curMetrics.costOfGoodsSold - curMetrics.salonCostOfGoodsSold);

  // Salon use grouped by service sold in period (from SERVICE lines + usage on same sale)
  const salonByService = await loadSalonUseByService(
    ctx.organizationId,
    ctx.start,
    ctx.end
  );

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      revenue: cmp(curMetrics.retailRevenue, prevMetrics.retailRevenue),
      unitsSold: cmp(curMetrics.unitsSold, prevMetrics.unitsSold),
      unitsSalonUsed: cmp(curMetrics.unitsSalonUsed, prevMetrics.unitsSalonUsed),
      cogs: cmp(curMetrics.costOfGoodsSold, prevMetrics.costOfGoodsSold),
      salonCogs: cmp(curMetrics.salonCostOfGoodsSold, prevMetrics.salonCostOfGoodsSold),
      retailCogs: cmp(curRetailCogs, prevRetailCogs),
      grossProfit: cmp(curMetrics.grossProfit, prevMetrics.grossProfit),
      margin: cmp(curMetrics.marginPercent, prevMetrics.marginPercent),
      belowCostCount: cmp(belowCostCount, prevBelowCostCount),
    },
    catalogCounts,
    top10: retailRows.slice(0, 10),
    bottom10: [...retailRows].sort((a, b) => a.revenue - b.revenue).slice(0, 10),
    byCategory: Object.entries(catMap).map(([name, value]) => ({ name, value })),
    detail,
    retailRows,
    salonRows,
    salonByService,
    notes: [
      "Customer / retail = products sold on POS as product lines (revenue + COGS).",
      "In-house / salon = products linked on Services → Salon stock and used when that service is sold (COGS only; revenue stays on the service ticket).",
      "Catalog counts show how many products are typed Customer / In-house / Both under Products.",
      "Net profit in Finances subtracts total product COGS (retail + salon use).",
    ],
  };
}

async function loadSalonUseByService(
  organizationId: string,
  start: Date,
  end: Date
): Promise<SalonUseByServiceRow[]> {
  const supabase = await getSupabase();

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

  const [{ data: usages }, { data: serviceLines }] = await Promise.all([
    supabase
      .from("sale_consumable_usages")
      .select("sale_id, quantity, unit_cost")
      .eq("organization_id", organizationId)
      .in("sale_id", saleIds),
    supabase
      .from("sale_items")
      .select("sale_id, item_id, name, quantity")
      .eq("organization_id", organizationId)
      .eq("item_type", "SERVICE")
      .in("sale_id", saleIds),
  ]);

  if (!usages?.length) return [];

  const usageBySale = new Map<string, { units: number; cogs: number; lines: number }>();
  for (const u of usages) {
    const qty = Math.floor(Number(u.quantity) || 0);
    const cogs = qty * (Number(u.unit_cost) || 0);
    const cur = usageBySale.get(u.sale_id) ?? { units: 0, cogs: 0, lines: 0 };
    cur.units += qty;
    cur.cogs = roundMoney(cur.cogs + cogs);
    cur.lines += 1;
    usageBySale.set(u.sale_id, cur);
  }

  // Attribute each sale's salon COGS equally across SERVICE lines on that sale
  const byService = new Map<
    string,
    { name: string; tickets: Set<string>; units: number; cogs: number; lines: number }
  >();

  const servicesBySale = new Map<string, { item_id: string; name: string; quantity: number }[]>();
  for (const line of serviceLines ?? []) {
    const list = servicesBySale.get(line.sale_id) ?? [];
    list.push({
      item_id: line.item_id,
      name: line.name,
      quantity: Number(line.quantity) || 1,
    });
    servicesBySale.set(line.sale_id, list);
  }

  for (const [saleId, usage] of usageBySale) {
    const services = servicesBySale.get(saleId) ?? [];
    if (!services.length) {
      const key = "_unknown";
      const cur = byService.get(key) ?? {
        name: "Service (unspecified)",
        tickets: new Set<string>(),
        units: 0,
        cogs: 0,
        lines: 0,
      };
      cur.tickets.add(saleId);
      cur.units += usage.units;
      cur.cogs = roundMoney(cur.cogs + usage.cogs);
      cur.lines += usage.lines;
      byService.set(key, cur);
      continue;
    }

    const totalSvcQty = services.reduce((s, x) => s + Math.max(1, x.quantity), 0) || 1;
    for (const svc of services) {
      const share = Math.max(1, svc.quantity) / totalSvcQty;
      const cur = byService.get(svc.item_id) ?? {
        name: svc.name,
        tickets: new Set<string>(),
        units: 0,
        cogs: 0,
        lines: 0,
      };
      cur.tickets.add(saleId);
      cur.units += usage.units * share;
      cur.cogs = roundMoney(cur.cogs + usage.cogs * share);
      cur.lines += usage.lines;
      byService.set(svc.item_id, cur);
    }
  }

  return [...byService.entries()]
    .map(([serviceId, row]) => ({
      serviceId,
      serviceName: row.name,
      tickets: row.tickets.size,
      productLines: row.lines,
      unitsUsed: Math.round(row.units * 100) / 100,
      salonCogs: roundMoney(row.cogs),
    }))
    .sort((a, b) => b.salonCogs - a.salonCogs);
}
