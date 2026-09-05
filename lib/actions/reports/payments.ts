"use server";

import { isoToLocalDateString } from "@/lib/dates/local";
import { roundMoney } from "@/lib/sales/calculate";
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

function isDepositApplication(reference: string | null | undefined) {
  return reference === "APPOINTMENT_DEPOSIT";
}

async function loadSaleStatusMap(organizationId: string, saleIds: string[]) {
  const map = new Map<string, { status: string; deleted: boolean }>();
  if (!saleIds.length) return map;
  const supabase = await getSupabase();
  for (let i = 0; i < saleIds.length; i += 200) {
    const chunk = saleIds.slice(i, i + 200);
    const { data } = await supabase
      .from("sales")
      .select("id, status, deleted_at")
      .eq("organization_id", organizationId)
      .in("id", chunk);
    for (const s of data ?? []) {
      map.set(s.id, { status: s.status, deleted: Boolean(s.deleted_at) });
    }
  }
  return map;
}

function isCountableSalePayment(
  saleId: string,
  statusMap: Map<string, { status: string; deleted: boolean }>
) {
  const s = statusMap.get(saleId);
  if (!s || s.deleted) return false;
  // Voided sales keep payment rows but are not live tender for KPIs
  return s.status !== "VOID";
}

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
        .select("sale_id, method, amount, reference")
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

  const payRowsAll = payments ?? [];
  const prevPayRowsAll = prevPayments ?? [];
  const statusMap = await loadSaleStatusMap(ctx.organizationId, [
    ...new Set([
      ...payRowsAll.map((p) => p.sale_id),
      ...prevPayRowsAll.map((p) => p.sale_id),
    ]),
  ]);

  const payRows = payRowsAll.filter((p) => isCountableSalePayment(p.sale_id, statusMap));
  const cashRows = payRows.filter((p) => !isDepositApplication(p.reference));
  const prevCashRows = prevPayRowsAll.filter(
    (p) => isCountableSalePayment(p.sale_id, statusMap) && !isDepositApplication(p.reference)
  );

  const sumMethod = (rows: { method: string; amount: number | string }[], method: string) =>
    roundMoney(
      rows
        .filter((p) => p.method === method)
        .reduce((a, p) => a + (Number(p.amount) || 0), 0)
    );

  const total = roundMoney(cashRows.reduce((a, p) => a + (Number(p.amount) || 0), 0));
  const prevTotal = roundMoney(prevCashRows.reduce((a, p) => a + (Number(p.amount) || 0), 0));
  const cash = sumMethod(cashRows, "CASH");
  const card = sumMethod(cashRows, "CARD");
  const other = sumMethod(cashRows, "OTHER");
  const prevCash = sumMethod(prevCashRows, "CASH");
  const prevCard = sumMethod(prevCashRows, "CARD");
  const prevOther = sumMethod(prevCashRows, "OTHER");

  const discounts = roundMoney(curSales.reduce((a, s) => a + s.discount, 0));
  const prevDiscounts = roundMoney(prevSales.reduce((a, s) => a + s.discount, 0));
  const refundTotal = roundMoney(
    (refunds ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0)
  );
  const prevRefundTotal = roundMoney(
    (prevRefunds ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0)
  );

  const methodMap: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const p of cashRows) {
    methodMap[p.method] = roundMoney((methodMap[p.method] ?? 0) + (Number(p.amount) || 0));
    const day = isoToLocalDateString(p.paid_at);
    byDay[day] = roundMoney((byDay[day] ?? 0) + (Number(p.amount) || 0));
  }

  const cashierMap = new Map<string, { sales: number; revenue: number }>();
  for (const s of curSales) {
    const key = s.created_by ?? "unknown";
    const cur = cashierMap.get(key) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue = roundMoney(cur.revenue + s.total);
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
      transactionCount: cmp(cashRows.length, prevCashRows.length),
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
    ledger: payRowsAll.map((p) => ({
      id: p.id,
      paidAt: p.paid_at,
      saleId: p.sale_id,
      method: p.method,
      amount: Number(p.amount) || 0,
      reference: p.reference,
    })),
    notes: [
      "Payment KPIs count cash/card/other tender only — deposit applications and VOID sale payments are excluded.",
      "Ledger still lists all payment rows (including deposit apps) for audit.",
      "Deposit refunds are appointment advances refunded — not POS sale returns.",
      "Sale-level refunds (amend/void/refund) live on sale_refunds.",
    ],
  };
}
