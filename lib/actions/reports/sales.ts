"use server";

import { getLocalHour, isoToLocalDateString } from "@/lib/dates/local";
import { formatCustomerName } from "@/lib/format";
import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  fetchSaleItems,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type SalesLedgerRow = {
  id: string;
  completedAt: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
  itemSummary: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: string;
};

export type SalesReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    totalSales: CompareResult;
    completedSales: CompareResult;
    voidedSales: CompareResult;
    grossSales: CompareResult;
    netSales: CompareResult;
    discounts: CompareResult;
    aov: CompareResult;
    itemsSold: CompareResult;
  };
  byDay: { label: string; value: number }[];
  byHour: { label: string; value: number }[];
  byPayment: { name: string; value: number }[];
  ledger: SalesLedgerRow[];
  notes: string[];
};

export async function getSalesReport(from?: string, to?: string): Promise<SalesReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [curSales, prevSales, voidCur, voidPrev] = await Promise.all([
    fetchCompletedSales(ctx, "current"),
    fetchCompletedSales(ctx, "previous"),
    countVoids(ctx.organizationId, ctx.start, ctx.end),
    countVoids(ctx.organizationId, ctx.prevStart, ctx.prevEnd),
  ]);

  const curIds = curSales.map((s) => s.id);
  const [items, invoices, payments, customers] = await Promise.all([
    fetchSaleItems(ctx.organizationId, curIds),
    fetchInvoices(ctx.organizationId, curIds),
    fetchPaymentsForSales(ctx.organizationId, curIds),
    fetchCustomers(
      ctx.organizationId,
      [...new Set(curSales.map((s) => s.customer_id).filter(Boolean) as string[])]
    ),
  ]);

  const prevItems = await fetchSaleItems(
    ctx.organizationId,
    prevSales.map((s) => s.id)
  );

  const total = curSales.reduce((a, s) => a + s.total, 0);
  const prevTotal = prevSales.reduce((a, s) => a + s.total, 0);
  const gross = curSales.reduce((a, s) => a + s.subtotal, 0);
  const prevGross = prevSales.reduce((a, s) => a + s.subtotal, 0);
  const discounts = curSales.reduce((a, s) => a + s.discount, 0);
  const prevDiscounts = prevSales.reduce((a, s) => a + s.discount, 0);
  const itemsSold = items.reduce((a, i) => a + i.quantity, 0);
  const prevItemsSold = prevItems.reduce((a, i) => a + i.quantity, 0);
  const aov = curSales.length ? total / curSales.length : 0;
  const prevAov = prevSales.length ? prevTotal / prevSales.length : 0;

  const byDay: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  for (let h = 0; h < 24; h++) byHour[String(h).padStart(2, "0")] = 0;

  for (const s of curSales) {
    if (!s.completed_at) continue;
    const d = new Date(s.completed_at);
    const day = isoToLocalDateString(s.completed_at);
    byDay[day] = (byDay[day] ?? 0) + s.total;
    const hour = String(getLocalHour(d)).padStart(2, "0");
    byHour[hour] = (byHour[hour] ?? 0) + 1;
  }

  const payMap: Record<string, number> = {};
  for (const p of payments) {
    payMap[p.method] = (payMap[p.method] ?? 0) + p.amount;
  }

  const itemsBySale = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    list.push(item);
    itemsBySale.set(item.sale_id, list);
  }

  const primaryPay = new Map<string, string>();
  for (const p of payments) {
    if (!primaryPay.has(p.sale_id)) primaryPay.set(p.sale_id, p.method);
  }

  const ledger: SalesLedgerRow[] = curSales
    .slice()
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .map((s) => {
      const saleItems = itemsBySale.get(s.id) ?? [];
      const customer = s.customer_id ? customers.get(s.customer_id) : null;
      return {
        id: s.id,
        completedAt: s.completed_at,
        invoiceNumber: invoices.get(s.id) ?? null,
        customerName: customer
          ? formatCustomerName(customer.first_name, customer.last_name)
          : null,
        itemSummary: saleItems
          .slice(0, 4)
          .map((i) => `${i.name}×${i.quantity}`)
          .join(", "),
        subtotal: s.subtotal,
        discount: s.discount,
        tax: s.tax,
        total: s.total,
        paymentMethod: primaryPay.get(s.id) ?? "—",
        status: s.status,
      };
    });

  void supabase;

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalSales: cmp(curSales.length, prevSales.length),
      completedSales: cmp(curSales.length, prevSales.length),
      voidedSales: cmp(voidCur, voidPrev),
      grossSales: cmp(gross, prevGross),
      netSales: cmp(total, prevTotal),
      discounts: cmp(discounts, prevDiscounts),
      aov: cmp(aov, prevAov),
      itemsSold: cmp(itemsSold, prevItemsSold),
    },
    byDay: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value })),
    byHour: Object.entries(byHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, value]) => ({ label: `${hour}:00`, value })),
    byPayment: Object.entries(payMap).map(([name, value]) => ({ name, value })),
    ledger,
    notes: [
      "Posted revenue includes COMPLETED and AMENDED (current version only). VOID and REFUNDED are excluded.",
      "Gross sales = sum of subtotals; net sales = sum of ticket totals.",
    ],
  };
}

async function countVoids(organizationId: string, start: Date, end: Date) {
  const supabase = await getSupabase();
  const { count } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "VOID")
    .gte("voided_at", start.toISOString())
    .lte("voided_at", end.toISOString());
  return count ?? 0;
}

async function fetchInvoices(organizationId: string, saleIds: string[]) {
  const map = new Map<string, string>();
  if (!saleIds.length) return map;
  const supabase = await getSupabase();
  for (let i = 0; i < saleIds.length; i += 200) {
    const chunk = saleIds.slice(i, i + 200);
    const { data } = await supabase
      .from("invoices")
      .select("sale_id, invoice_number")
      .eq("organization_id", organizationId)
      .in("sale_id", chunk);
    for (const row of data ?? []) map.set(row.sale_id, row.invoice_number);
  }
  return map;
}

async function fetchPaymentsForSales(organizationId: string, saleIds: string[]) {
  if (!saleIds.length) return [] as { sale_id: string; method: string; amount: number }[];
  const supabase = await getSupabase();
  const rows: { sale_id: string; method: string; amount: number }[] = [];
  for (let i = 0; i < saleIds.length; i += 200) {
    const chunk = saleIds.slice(i, i + 200);
    const { data } = await supabase
      .from("payments")
      .select("sale_id, method, amount")
      .eq("organization_id", organizationId)
      .in("sale_id", chunk);
    for (const p of data ?? []) {
      rows.push({ sale_id: p.sale_id, method: p.method, amount: Number(p.amount) || 0 });
    }
  }
  return rows;
}

async function fetchCustomers(organizationId: string, ids: string[]) {
  const map = new Map<string, { first_name: string; last_name: string | null }>();
  if (!ids.length) return map;
  const supabase = await getSupabase();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("organization_id", organizationId)
      .in("id", chunk);
    for (const c of data ?? []) map.set(c.id, c);
  }
  return map;
}
