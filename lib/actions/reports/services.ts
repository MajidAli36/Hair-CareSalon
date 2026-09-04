"use server";

import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  fetchSaleItems,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type ServiceRow = {
  serviceId: string;
  name: string;
  category: string | null;
  qty: number;
  revenue: number;
  avgPrice: number;
  pctOfServiceRevenue: number;
};

export type ServicesReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    serviceRevenue: CompareResult;
    servicesSold: CompareResult;
    avgServiceValue: CompareResult;
    uniqueServices: CompareResult;
    serviceDiscountsNote: string;
  };
  top10: ServiceRow[];
  bottom10: ServiceRow[];
  byCategory: { name: string; value: number }[];
  byHour: { label: string; value: number }[];
  detail: ServiceRow[];
  unavailable: { profit: string };
};

export async function getServicesReport(from?: string, to?: string): Promise<ServicesReport> {
  const ctx = await createReportContext(from, to);
  const [curSales, prevSales] = await Promise.all([
    fetchCompletedSales(ctx, "current"),
    fetchCompletedSales(ctx, "previous"),
  ]);

  const [curItems, prevItems] = await Promise.all([
    fetchSaleItems(ctx.organizationId, curSales.map((s) => s.id)),
    fetchSaleItems(ctx.organizationId, prevSales.map((s) => s.id)),
  ]);

  const curSvc = curItems.filter((i) => i.item_type === "SERVICE");
  const prevSvc = prevItems.filter((i) => i.item_type === "SERVICE");

  const saleTime = new Map(curSales.map((s) => [s.id, s.completed_at]));
  const byHour: Record<string, number> = {};
  for (let h = 0; h < 24; h++) byHour[String(h).padStart(2, "0")] = 0;
  for (const item of curSvc) {
    const iso = saleTime.get(item.sale_id);
    if (!iso) continue;
    const hour = String(new Date(iso).getHours()).padStart(2, "0");
    byHour[hour] = (byHour[hour] ?? 0) + item.quantity;
  }

  const serviceMeta = await fetchServiceMeta(
    ctx.organizationId,
    [...new Set(curSvc.map((i) => i.item_id))]
  );

  const agg = new Map<
    string,
    { serviceId: string; name: string; category: string | null; qty: number; revenue: number }
  >();
  for (const item of curSvc) {
    const meta = serviceMeta.get(item.item_id);
    const cur = agg.get(item.item_id) ?? {
      serviceId: item.item_id,
      name: meta?.name ?? item.name,
      category: meta?.category ?? null,
      qty: 0,
      revenue: 0,
    };
    cur.qty += item.quantity;
    cur.revenue += item.line_total;
    agg.set(item.item_id, cur);
  }

  const totalRevenue = [...agg.values()].reduce((a, r) => a + r.revenue, 0);
  const prevRevenue = prevSvc.reduce((a, i) => a + i.line_total, 0);
  const qty = curSvc.reduce((a, i) => a + i.quantity, 0);
  const prevQty = prevSvc.reduce((a, i) => a + i.quantity, 0);

  const detail: ServiceRow[] = [...agg.values()]
    .map((r) => ({
      ...r,
      avgPrice: r.qty ? r.revenue / r.qty : 0,
      pctOfServiceRevenue: totalRevenue ? (r.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

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
      serviceRevenue: cmp(totalRevenue, prevRevenue),
      servicesSold: cmp(qty, prevQty),
      avgServiceValue: cmp(qty ? totalRevenue / qty : 0, prevQty ? prevRevenue / prevQty : 0),
      uniqueServices: cmp(detail.length, new Set(prevSvc.map((i) => i.item_id)).size),
      serviceDiscountsNote:
        "Sale-level discounts are not allocated to individual services.",
    },
    top10: detail.slice(0, 10),
    bottom10: [...detail].reverse().slice(0, 10),
    byCategory: Object.entries(catMap).map(([name, value]) => ({ name, value })),
    byHour: Object.entries(byHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, value]) => ({ label: `${hour}:00`, value })),
    detail,
    unavailable: {
      profit: "Services have no cost_price in the catalog — service profit/margin cannot be calculated.",
    },
  };
}

async function fetchServiceMeta(organizationId: string, ids: string[]) {
  const map = new Map<string, { name: string; category: string | null }>();
  if (!ids.length) return map;
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("services")
    .select("id, name, category:service_categories(name)")
    .eq("organization_id", organizationId)
    .in("id", ids);
  for (const s of data ?? []) {
    const cat = s.category as unknown as { name: string } | { name: string }[] | null;
    const category = Array.isArray(cat) ? cat[0]?.name ?? null : cat?.name ?? null;
    map.set(s.id, { name: s.name, category });
  }
  return map;
}
