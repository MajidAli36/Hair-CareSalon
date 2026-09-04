"use server";

import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type PaymentLedgerRow = {
  id: string;
  paidAt: string;
  saleId: string;
  method: string;
  amount: number;
  reference: string | null;
};

export type PaymentsReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    totalPayments: CompareResult;
    cash: CompareResult;
    card: CompareResult;
    other: CompareResult;
    discounts: CompareResult;
    depositRefunds: CompareResult;
    transactionCount: CompareResult;
  };
  byMethod: { name: string; value: number }[];
  byDay: { label: string; value: number }[];
  cashierPerformance: { name: string; sales: number; revenue: number }[];
  discountSales: { saleId: string; discount: number; total: number; completedAt: string | null }[];
  depositRefunds: {
    id: string;
    amount: number;
    refundedAt: string | null;
    method: string | null;
  }[];
  ledger: PaymentLedgerRow[];
  notes: string[];
};

export async function getPaymentsReport(from?: string, to?: string): Promise<PaymentsReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [curSales, prevSales, { data: payments }, { data: prevPayments }, { data: refunds }, { data: prevRefunds }] =
    await Promise.all([
      fetchCompletedSales(ctx, "current"),
      fetchCompletedSales(ctx, "previous"),
      supabase
        .from("payments")
        .select("id, sale_id, method, amount, reference, paid_at")
        .eq("organization_id", ctx.organizationId)
        .gte("paid_at", ctx.start.toISOString())
        .lte("paid_at", ctx.end.toISOString())
        .order("paid_at", { ascending: false }),
      supabase
        .from("payments")
        .select("method, amount")
        .eq("organization_id", ctx.organizationId)
        .gte("paid_at", ctx.prevStart.toISOString())
        .lte("paid_at", ctx.prevEnd.toISOString()),
      supabase
        .from("appointment_deposits")
        .select("id, amount, refunded_at, refund_method")
        .eq("organization_id", ctx.organizationId)
        .eq("status", "REFUNDED")
        .gte("refunded_at", ctx.start.toISOString())
        .lte("refunded_at", ctx.end.toISOString()),
      supabase
        .from("appointment_deposits")
        .select("amount")
        .eq("organization_id", ctx.organizationId)
        .eq("status", "REFUNDED")
        .gte("refunded_at", ctx.prevStart.toISOString())
        .lte("refunded_at", ctx.prevEnd.toISOString()),
    ]);

  const payRows = payments ?? [];
  const sumMethod = (rows: { method: string; amount: number | string }[], method: string) =>
    rows
      .filter((p) => p.method === method)
      .reduce((a, p) => a + (Number(p.amount) || 0), 0);

  const total = payRows.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const prevTotal = (prevPayments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const cash = sumMethod(payRows, "CASH");
  const card = sumMethod(payRows, "CARD");
  const other = sumMethod(payRows, "OTHER");
  const prevCash = sumMethod(prevPayments ?? [], "CASH");
  const prevCard = sumMethod(prevPayments ?? [], "CARD");
  const prevOther = sumMethod(prevPayments ?? [], "OTHER");

  const discounts = curSales.reduce((a, s) => a + s.discount, 0);
  const prevDiscounts = prevSales.reduce((a, s) => a + s.discount, 0);
  const refundTotal = (refunds ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const prevRefundTotal = (prevRefunds ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0);

  const methodMap: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const p of payRows) {
    methodMap[p.method] = (methodMap[p.method] ?? 0) + (Number(p.amount) || 0);
    const day = p.paid_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + (Number(p.amount) || 0);
  }

  // Cashier via sales.created_by (auth user id) — no profiles table; show short id labels
  const cashierMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of curSales) {
    const key = s.created_by ?? "unknown";
    const cur = cashierMap.get(key) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += s.total;
    cashierMap.set(key, cur);
  }

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalPayments: cmp(total, prevTotal),
      cash: cmp(cash, prevCash),
      card: cmp(card, prevCard),
      other: cmp(other, prevOther),
      discounts: cmp(discounts, prevDiscounts),
      depositRefunds: cmp(refundTotal, prevRefundTotal),
      transactionCount: cmp(payRows.length, (prevPayments ?? []).length),
    },
    byMethod: Object.entries(methodMap).map(([name, value]) => ({ name, value })),
    byDay: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value })),
    cashierPerformance: [...cashierMap.entries()]
      .map(([id, v]) => ({
        name: id === "unknown" ? "Unknown" : `Cashier ${id.slice(0, 8)}`,
        sales: v.sales,
        revenue: v.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    discountSales: curSales
      .filter((s) => s.discount > 0)
      .map((s) => ({
        saleId: s.id,
        discount: s.discount,
        total: s.total,
        completedAt: s.completed_at,
      }))
      .sort((a, b) => b.discount - a.discount),
    depositRefunds: (refunds ?? []).map((r) => ({
      id: r.id,
      amount: Number(r.amount) || 0,
      refundedAt: r.refunded_at,
      method: r.refund_method,
    })),
    ledger: payRows.map((p) => ({
      id: p.id,
      paidAt: p.paid_at,
      saleId: p.sale_id,
      method: p.method,
      amount: Number(p.amount) || 0,
      reference: p.reference,
    })),
    notes: [
      "Payment methods reflect values stored on payment rows (typically CASH, CARD, OTHER).",
      "Deposit refunds are appointment advances refunded — not POS sale returns.",
      "Sale-level refunds (amend/void/refund) live on sale_refunds and appear as expenses when cash leaves the drawer.",
    ],
  };
}
