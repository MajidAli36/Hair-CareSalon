"use server";

import {
  getProductSalesBreakdown,
  getProductSalesMetrics,
} from "@/lib/inventory/sales-metrics";
import { cmp, createReportContext, getSupabase } from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type ProductReportRow = {
  productId: string;
  name: string;
  sku: string | null;
  category: string | null;
  qtySold: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  currentStock: number;
  belowCost: boolean;
};

export type ProductsReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    revenue: CompareResult;
    unitsSold: CompareResult;
    cogs: CompareResult;
    grossProfit: CompareResult;
    margin: CompareResult;
    belowCostCount: CompareResult;
  };
  top10: ProductReportRow[];
  bottom10: ProductReportRow[];
  byCategory: { name: string; value: number }[];
  detail: ProductReportRow[];
};

export async function getProductsReport(from?: string, to?: string): Promise<ProductsReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [curRows, prevMetrics, curMetrics] = await Promise.all([
    getProductSalesBreakdown(ctx.organizationId, ctx.from, ctx.to),
    getProductSalesMetrics(ctx.organizationId, ctx.prevFrom, ctx.prevTo),
    getProductSalesMetrics(ctx.organizationId, ctx.from, ctx.to),
  ]);

  const productIds = curRows.map((r) => r.productId);
  const meta = new Map<string, { category: string | null; stock: number }>();
  if (productIds.length) {
    const { data } = await supabase
      .from("products")
      .select("id, stock_quantity, category:product_categories(name)")
      .eq("organization_id", ctx.organizationId)
      .in("id", productIds);
    for (const p of data ?? []) {
      const cat = p.category as unknown as { name: string } | { name: string }[] | null;
      const category = Array.isArray(cat) ? cat[0]?.name ?? null : cat?.name ?? null;
      meta.set(p.id, { category, stock: Number(p.stock_quantity) || 0 });
    }
  }

  const detail: ProductReportRow[] = curRows.map((r) => {
    const m = meta.get(r.productId);
    return {
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      category: m?.category ?? null,
      qtySold: r.qtySold,
      revenue: r.retailRevenue,
      cogs: r.costOfGoodsSold,
      profit: r.grossProfit,
      marginPercent: r.marginPercent,
      currentStock: m?.stock ?? 0,
      belowCost: r.grossProfit < 0,
    };
  });

  const belowCostCount = detail.filter((d) => d.belowCost).length;
  const catMap: Record<string, number> = {};
  for (const row of detail) {
    const key = row.category ?? "Uncategorized";
    catMap[key] = (catMap[key] ?? 0) + row.revenue;
  }

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      revenue: cmp(curMetrics.retailRevenue, prevMetrics.retailRevenue),
      unitsSold: cmp(curMetrics.unitsSold, prevMetrics.unitsSold),
      cogs: cmp(curMetrics.costOfGoodsSold, prevMetrics.costOfGoodsSold),
      grossProfit: cmp(curMetrics.grossProfit, prevMetrics.grossProfit),
      margin: cmp(curMetrics.marginPercent, prevMetrics.marginPercent),
      belowCostCount: cmp(belowCostCount, 0),
    },
    top10: detail.slice(0, 10),
    bottom10: [...detail].sort((a, b) => a.revenue - b.revenue).slice(0, 10),
    byCategory: Object.entries(catMap).map(([name, value]) => ({ name, value })),
    detail,
  };
}
