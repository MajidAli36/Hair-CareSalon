"use server";

import { createReportContext, getSupabase } from "@/lib/reports/context";
import { endOfLocalDay, getLocalDateString, startOfLocalDay } from "@/lib/dates/local";
import { roundMoney } from "@/lib/sales/calculate";

export type DueAgingBucket = {
  label: string;
  amount: number;
  invoiceCount: number;
  customerCount: number;
};

export type DueLedgerRow = {
  saleId: string;
  customerId: string | null;
  customerName: string;
  phone: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  total: number;
  paid: number;
  due: number;
  lastPaymentAt: string | null;
  daysOutstanding: number;
  status: "CURRENT" | "OVERDUE";
};

export type DuesReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    totalOutstanding: number;
    customersWithDue: number;
    invoicesWithDue: number;
    collectedToday: number;
    collectedThisMonth: number;
    overdueAmount: number;
  };
  aging: DueAgingBucket[];
  ledger: DueLedgerRow[];
  notes: string[];
};

function daysBetween(fromIso: string, toDate: Date) {
  const a = new Date(fromIso);
  const ms = toDate.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function agingLabel(days: number) {
  if (days <= 7) return "0–7 days";
  if (days <= 30) return "8–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

export async function getDuesReport(from?: string, to?: string): Promise<DuesReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();
  const today = getLocalDateString(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;

  const { data: dueSales, error } = await supabase
    .from("sales")
    .select(
      `
      id, customer_id, total, amount_paid, amount_due, completed_at, payment_status,
      customer:customers(first_name, last_name, phone),
      invoice:invoices(invoice_number)
    `
    )
    .eq("organization_id", ctx.organizationId)
    .in("status", ["COMPLETED", "AMENDED"])
    .gt("amount_due", 0)
    .order("completed_at", { ascending: true });

  if (error) throw new Error(error.message);

  const saleIds = (dueSales ?? []).map((s) => s.id);
  const lastPayMap = new Map<string, string>();
  if (saleIds.length) {
    const { data: pays } = await supabase
      .from("payments")
      .select("sale_id, paid_at")
      .eq("organization_id", ctx.organizationId)
      .in("sale_id", saleIds)
      .order("paid_at", { ascending: false });
    for (const p of pays ?? []) {
      if (!lastPayMap.has(p.sale_id)) lastPayMap.set(p.sale_id, p.paid_at);
    }
  }

  const now = new Date();
  const agingMap = new Map<string, { amount: number; invoices: Set<string>; customers: Set<string> }>();
  for (const label of ["0–7 days", "8–30 days", "31–60 days", "61–90 days", "90+ days"]) {
    agingMap.set(label, { amount: 0, invoices: new Set(), customers: new Set() });
  }

  const ledger: DueLedgerRow[] = [];
  let totalOutstanding = 0;
  const customers = new Set<string>();
  let overdueAmount = 0;

  for (const s of dueSales ?? []) {
    const due = Number(s.amount_due);
    totalOutstanding += due;
    if (s.customer_id) customers.add(s.customer_id);
    const completedAt = s.completed_at ?? now.toISOString();
    const days = daysBetween(completedAt, now);
    const label = agingLabel(days);
    const bucket = agingMap.get(label)!;
    bucket.amount += due;
    bucket.invoices.add(s.id);
    if (s.customer_id) bucket.customers.add(s.customer_id);

    const overdue = days > 7;
    if (overdue) overdueAmount += due;

    const cust = s.customer as unknown as
      | { first_name: string; last_name: string | null; phone: string | null }
      | { first_name: string; last_name: string | null; phone: string | null }[]
      | null;
    const c = Array.isArray(cust) ? cust[0] : cust;
    const inv = Array.isArray(s.invoice) ? s.invoice[0] : s.invoice;

    ledger.push({
      saleId: s.id,
      customerId: s.customer_id,
      customerName: c
        ? `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`
        : "Walk-in",
      phone: c?.phone ?? null,
      invoiceNumber: inv?.invoice_number ?? null,
      invoiceDate: s.completed_at,
      total: Number(s.total),
      paid: Number(s.amount_paid),
      due,
      lastPaymentAt: lastPayMap.get(s.id) ?? null,
      daysOutstanding: days,
      status: overdue ? "OVERDUE" : "CURRENT",
    });
  }

  const [{ data: todayPays }, { data: monthPays }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("organization_id", ctx.organizationId)
      .gte("paid_at", startOfLocalDay(today).toISOString())
      .lte("paid_at", endOfLocalDay(today).toISOString()),
    supabase
      .from("payments")
      .select("amount")
      .eq("organization_id", ctx.organizationId)
      .gte("paid_at", startOfLocalDay(monthStart).toISOString()),
  ]);

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalOutstanding: roundMoney(totalOutstanding),
      customersWithDue: customers.size,
      invoicesWithDue: ledger.length,
      collectedToday: roundMoney(
        (todayPays ?? []).reduce((a, p) => a + Number(p.amount), 0)
      ),
      collectedThisMonth: roundMoney(
        (monthPays ?? []).reduce((a, p) => a + Number(p.amount), 0)
      ),
      overdueAmount: roundMoney(overdueAmount),
    },
    aging: [...agingMap.entries()].map(([label, v]) => ({
      label,
      amount: roundMoney(v.amount),
      invoiceCount: v.invoices.size,
      customerCount: v.customers.size,
    })),
    ledger,
    notes: [
      "Outstanding = invoice total − payments + refunds on posted sales (COMPLETED/AMENDED).",
      "Revenue reports still use invoice totals — not cash collected.",
      "Overdue threshold: more than 7 days since completion.",
    ],
  };
}
