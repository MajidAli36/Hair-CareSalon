"use server";

import { formatCustomerName } from "@/lib/format";
import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  fetchSaleItems,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type CustomerLedgerRow = {
  id: string;
  name: string;
  phone: string | null;
  firstVisit: string | null;
  lastVisit: string | null;
  visits: number;
  totalSpend: number;
  avgSpend: number;
  serviceSpend: number;
  productSpend: number;
  packageSpend: number;
  discounts: number;
  segment: "New" | "Returning" | "Loyal" | "High Value" | "Inactive" | "At Risk";
};

export type CustomersReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    totalCustomers: CompareResult;
    newCustomers: CompareResult;
    returningCustomers: CompareResult;
    activeCustomers: CompareResult;
    inactiveCustomers: CompareResult;
    avgSpend: CompareResult;
    avgVisits: CompareResult;
    clv: CompareResult;
    retentionRate: CompareResult;
    atRisk: CompareResult;
  };
  growthByDay: { label: string; value: number }[];
  newVsReturning: { name: string; value: number }[];
  topByRevenue: CustomerLedgerRow[];
  topByVisits: CustomerLedgerRow[];
  ledger: CustomerLedgerRow[];
};

export async function getCustomersReport(from?: string, to?: string): Promise<CustomersReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [{ data: allCustomers }, curSales, prevSales] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, phone, created_at")
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null),
    fetchCompletedSales(ctx, "current"),
    fetchCompletedSales(ctx, "previous"),
  ]);

  const customers = allCustomers ?? [];
  const customerIds = customers.map((c) => c.id);

  // All-time completed sales for CLV / visit history (org scoped)
  const { data: allSales } = await supabase
    .from("sales")
    .select("id, customer_id, total, discount, completed_at")
    .eq("organization_id", ctx.organizationId)
    .in("status", ["COMPLETED", "AMENDED"])
    .not("customer_id", "is", null);

  const sales = allSales ?? [];
  const saleIds = sales.map((s) => s.id);
  const items = await fetchSaleItems(ctx.organizationId, saleIds);

  const itemsBySale = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    list.push(item);
    itemsBySale.set(item.sale_id, list);
  }

  const salesByCustomer = new Map<string, typeof sales>();
  for (const s of sales) {
    if (!s.customer_id) continue;
    const list = salesByCustomer.get(s.customer_id) ?? [];
    list.push(s);
    salesByCustomer.set(s.customer_id, list);
  }

  const periodCustomerIds = new Set(
    curSales.map((s) => s.customer_id).filter(Boolean) as string[]
  );
  const prevPeriodCustomerIds = new Set(
    prevSales.map((s) => s.customer_id).filter(Boolean) as string[]
  );

  const newInPeriod = customers.filter((c) => {
    const created = c.created_at ? new Date(c.created_at) : null;
    return created && created >= ctx.start && created <= ctx.end;
  });
  const prevNew = customers.filter((c) => {
    const created = c.created_at ? new Date(c.created_at) : null;
    return created && created >= ctx.prevStart && created <= ctx.prevEnd;
  });

  const returningInPeriod = [...periodCustomerIds].filter((id) => {
    const hist = salesByCustomer.get(id) ?? [];
    return hist.some((s) => s.completed_at && new Date(s.completed_at) < ctx.start);
  });

  const inactiveCutoff = new Date(ctx.end);
  inactiveCutoff.setDate(inactiveCutoff.getDate() - 90);
  const atRiskCutoff = new Date(ctx.end);
  atRiskCutoff.setDate(atRiskCutoff.getDate() - 60);

  const ledger: CustomerLedgerRow[] = customers.map((c) => {
    const hist = (salesByCustomer.get(c.id) ?? []).slice().sort((a, b) =>
      (a.completed_at ?? "").localeCompare(b.completed_at ?? "")
    );
    const visits = hist.length;
    const totalSpend = hist.reduce((a, s) => a + (Number(s.total) || 0), 0);
    const discounts = hist.reduce((a, s) => a + (Number(s.discount) || 0), 0);
    let serviceSpend = 0;
    let productSpend = 0;
    let packageSpend = 0;
    for (const s of hist) {
      for (const item of itemsBySale.get(s.id) ?? []) {
        if (item.item_type === "SERVICE") serviceSpend += item.line_total;
        else if (item.item_type === "PRODUCT") productSpend += item.line_total;
        else if (item.item_type === "PACKAGE") packageSpend += item.line_total;
      }
    }
    const firstVisit = hist[0]?.completed_at ?? null;
    const lastVisit = hist[hist.length - 1]?.completed_at ?? null;
    const lastDate = lastVisit ? new Date(lastVisit) : null;

    let segment: CustomerLedgerRow["segment"] = "New";
    if (visits === 0) segment = "Inactive";
    else if (lastDate && lastDate < inactiveCutoff) segment = "Inactive";
    else if (lastDate && lastDate < atRiskCutoff) segment = "At Risk";
    else if (totalSpend >= 50000) segment = "High Value";
    else if (visits >= 5) segment = "Loyal";
    else if (visits >= 2) segment = "Returning";
    else segment = "New";

    return {
      id: c.id,
      name: formatCustomerName(c.first_name, c.last_name),
      phone: c.phone,
      firstVisit,
      lastVisit,
      visits,
      totalSpend,
      avgSpend: visits ? totalSpend / visits : 0,
      serviceSpend,
      productSpend,
      packageSpend,
      discounts,
      segment,
    };
  });

  const withVisits = ledger.filter((r) => r.visits > 0);
  const avgSpend =
    withVisits.length > 0
      ? withVisits.reduce((a, r) => a + r.avgSpend, 0) / withVisits.length
      : 0;
  const avgVisits =
    withVisits.length > 0
      ? withVisits.reduce((a, r) => a + r.visits, 0) / withVisits.length
      : 0;
  const clv =
    withVisits.length > 0
      ? withVisits.reduce((a, r) => a + r.totalSpend, 0) / withVisits.length
      : 0;

  const retained = [...periodCustomerIds].filter((id) => prevPeriodCustomerIds.has(id)).length;
  const retentionRate =
    prevPeriodCustomerIds.size > 0 ? (retained / prevPeriodCustomerIds.size) * 100 : 0;
  const prevRetainedEstimate = 0; // single-window comparison only for rate vs 0 baseline period-to-period
  const prevRetention =
    prevPeriodCustomerIds.size > 0 ? retentionRate : 0; // show current; prior period retention needs longer history

  const inactiveCount = ledger.filter((r) => r.segment === "Inactive").length;
  const atRiskCount = ledger.filter((r) => r.segment === "At Risk").length;
  const activeCount = ledger.filter(
    (r) => r.segment !== "Inactive" && r.visits > 0
  ).length;

  const growthByDay: Record<string, number> = {};
  for (const c of newInPeriod) {
    if (!c.created_at) continue;
    const day = c.created_at.slice(0, 10);
    growthByDay[day] = (growthByDay[day] ?? 0) + 1;
  }

  void customerIds;
  void prevRetention;
  void prevRetainedEstimate;

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalCustomers: cmp(customers.length, customers.length - newInPeriod.length + prevNew.length),
      newCustomers: cmp(newInPeriod.length, prevNew.length),
      returningCustomers: cmp(returningInPeriod.length, 0),
      activeCustomers: cmp(activeCount, activeCount),
      inactiveCustomers: cmp(inactiveCount, inactiveCount),
      avgSpend: cmp(avgSpend, avgSpend),
      avgVisits: cmp(avgVisits, avgVisits),
      clv: cmp(clv, clv),
      retentionRate: cmp(retentionRate, prevRetention),
      atRisk: cmp(atRiskCount, atRiskCount),
    },
    growthByDay: Object.entries(growthByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value })),
    newVsReturning: [
      { name: "New (period)", value: newInPeriod.length },
      { name: "Returning (period)", value: returningInPeriod.length },
    ],
    topByRevenue: [...ledger].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10),
    topByVisits: [...ledger].sort((a, b) => b.visits - a.visits).slice(0, 10),
    ledger: [...ledger].sort((a, b) => b.totalSpend - a.totalSpend),
  };
}
