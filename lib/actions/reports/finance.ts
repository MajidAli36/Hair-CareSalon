"use server";

import { getFinancialSummary } from "@/lib/actions/finances";
import { roundMoney } from "@/lib/sales/calculate";
import {
  cmp,
  createReportContext,
  fetchCompletedSales,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type FinanceReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    grossRevenue: CompareResult;
    discounts: CompareResult;
    netRevenue: CompareResult;
    cogs: CompareResult;
    grossProfit: CompareResult;
    grossMargin: CompareResult;
    expenses: CompareResult;
    staffPayments: CompareResult;
    netProfit: CompareResult;
    netMargin: CompareResult;
  };
  waterfall: { label: string; value: number }[];
  expensesByCategory: { name: string; value: number }[];
  notes: string[];
};

export async function getFinanceReport(from?: string, to?: string): Promise<FinanceReport> {
  const ctx = await createReportContext(from, to);
  const [cur, prev, curSales, prevSales] = await Promise.all([
    getFinancialSummary(ctx.from, ctx.to),
    getFinancialSummary(ctx.prevFrom, ctx.prevTo),
    fetchCompletedSales(ctx, "current"),
    fetchCompletedSales(ctx, "previous"),
  ]);

  const discounts = roundMoney(curSales.reduce((a, s) => a + s.discount, 0));
  const prevDiscounts = roundMoney(prevSales.reduce((a, s) => a + s.discount, 0));
  const tax = roundMoney(curSales.reduce((a, s) => a + s.tax, 0));
  const grossSubtotal = roundMoney(curSales.reduce((a, s) => a + s.subtotal, 0));
  const prevGrossSubtotal = roundMoney(prevSales.reduce((a, s) => a + s.subtotal, 0));

  const grossProfit = roundMoney(cur.salesRevenue - cur.productCogs);
  const prevGrossProfit = roundMoney(prev.salesRevenue - prev.productCogs);
  const grossMargin = cur.salesRevenue > 0 ? (grossProfit / cur.salesRevenue) * 100 : 0;
  const prevGrossMargin = prev.salesRevenue > 0 ? (prevGrossProfit / prev.salesRevenue) * 100 : 0;
  const netMargin = cur.salesRevenue > 0 ? (cur.netProfit / cur.salesRevenue) * 100 : 0;
  const prevNetMargin = prev.salesRevenue > 0 ? (prev.netProfit / prev.salesRevenue) * 100 : 0;

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      grossRevenue: cmp(grossSubtotal, prevGrossSubtotal),
      discounts: cmp(discounts, prevDiscounts),
      netRevenue: cmp(cur.salesRevenue, prev.salesRevenue),
      cogs: cmp(cur.productCogs, prev.productCogs),
      grossProfit: cmp(grossProfit, prevGrossProfit),
      grossMargin: cmp(grossMargin, prevGrossMargin),
      expenses: cmp(cur.totalExpenses, prev.totalExpenses),
      staffPayments: cmp(cur.staffPayments, prev.staffPayments),
      netProfit: cmp(cur.netProfit, prev.netProfit),
      netMargin: cmp(netMargin, prevNetMargin),
    },
    waterfall: [
      { label: "Gross (subtotal)", value: grossSubtotal },
      { label: "Discounts", value: -discounts },
      { label: "Tax", value: tax },
      { label: "Net ticket revenue", value: cur.salesRevenue },
      { label: "Product COGS", value: -cur.productCogs },
      { label: "Gross profit", value: grossProfit },
      { label: "Operating expenses", value: -cur.totalExpenses },
      { label: "Staff payments", value: -cur.staffPayments },
      { label: "Net profit", value: cur.netProfit },
    ],
    expensesByCategory: cur.expensesByCategory.map((e) => ({
      name: e.label,
      value: e.amount,
    })),
    notes: [
      "Net ticket = subtotal − discounts + tax (matches completed/amended sale totals).",
      "Net profit = ticket revenue − partial sale refunds − operating expenses − staff payments − product COGS.",
      "Full void/refund removes the ticket from revenue (not also booked as an operating expense).",
      "Appointment advances are tracked separately and are not added on top of ticket revenue in net profit.",
      "Service/package COGS is unavailable — only product cost is deducted.",
      "Manage expense entry on the Finances page.",
    ],
  };
}
