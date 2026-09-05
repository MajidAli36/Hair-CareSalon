"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/finances/categories";
import { formatPeriodLabel } from "@/lib/finances/periods";
import { parseLocalDateRange } from "@/lib/dates/local";
import { roundMoney } from "@/lib/sales/calculate";
import {
  getInventoryMoneySnapshot,
  getProductSalesBreakdown,
  getRevenueSplit,
  type ProductSaleRow,
} from "@/lib/inventory/sales-metrics";

export type { ExpenseCategory } from "@/lib/finances/categories";

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string;
  created_at: string;
};

export type FinancialSummary = {
  salesRevenue: number;
  advancesCollected: number;
  cashFromSales: number;
  totalExpenses: number;
  staffPayments: number;
  productCogs: number;
  productRetailRevenue: number;
  productGrossProfit: number;
  productUnitsSold: number;
  productMarginPercent: number;
  serviceRevenue: number;
  inventoryValueAtCost: number;
  inventoryValueAtRetail: number;
  inventoryUnitsOnHand: number;
  productSaleRows: ProductSaleRow[];
  totalInflow: number;
  totalOutflow: number;
  netProfit: number;
  netCashFlow: number;
  unappliedDeposits: number;
  saleCount: number;
  expenseCount: number;
  staffPaymentCount: number;
  periodLabel: string;
  expensesByCategory: { category: ExpenseCategory; label: string; amount: number }[];
};

function parseDateRange(from?: string, to?: string) {
  return parseLocalDateRange(from, to);
}

/** Legacy rows that mirrored sale_refunds into expenses — exclude from opex to avoid double-count. */
function isLegacySaleRefundExpense(description: string | null | undefined) {
  if (!description) return false;
  return (
    description.startsWith("Voided invoice refund") ||
    description.startsWith("Invoice amendment refund") ||
    description.startsWith("Sale refund")
  );
}

export async function getFinancialSummary(from?: string, to?: string): Promise<FinancialSummary> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { start, end, fromLabel, toLabel } = parseDateRange(from, to);

  const [
    { data: sales },
    { data: deposits },
    { data: expenses },
    { data: unapplied },
    { data: staffPay },
    { data: salePayments },
    { data: periodRefunds },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total")
      .eq("organization_id", org.organizationId)
      .in("status", ["COMPLETED", "AMENDED"])
      .is("deleted_at", null)
      .gte("completed_at", start.toISOString())
      .lte("completed_at", end.toISOString()),
    // Include REFUNDED so historical inflow is not erased when an advance is later refunded
    supabase
      .from("appointment_deposits")
      .select("amount")
      .eq("organization_id", org.organizationId)
      .in("status", ["APPROVED", "REFUNDED"])
      .gte("paid_at", start.toISOString())
      .lte("paid_at", end.toISOString()),
    supabase
      .from("expenses")
      .select("category, amount, description")
      .eq("organization_id", org.organizationId)
      .gte("expense_date", fromLabel)
      .lte("expense_date", toLabel),
    supabase
      .from("appointment_deposits")
      .select("amount")
      .eq("organization_id", org.organizationId)
      .eq("status", "APPROVED")
      .is("applied_to_sale_id", null),
    supabase
      .from("staff_payments")
      .select("amount")
      .eq("organization_id", org.organizationId)
      .gte("payment_date", fromLabel)
      .lte("payment_date", toLabel),
      supabase
        .from("payments")
        .select("amount, reference, sale_id")
        .eq("organization_id", org.organizationId)
        .gte("paid_at", start.toISOString())
        .lte("paid_at", end.toISOString()),
      supabase
        .from("sale_refunds")
        .select("amount, sale_id")
        .eq("organization_id", org.organizationId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
    ]);

  const salesRevenue = roundMoney((sales ?? []).reduce((sum, s) => sum + Number(s.total), 0));
  const advancesCollected = roundMoney(
    (deposits ?? []).reduce((sum, d) => sum + Number(d.amount), 0)
  );
  const operatingRows = (expenses ?? []).filter((e) => !isLegacySaleRefundExpense(e.description));
  const totalExpenses = roundMoney(
    operatingRows.reduce((sum, e) => sum + Number(e.amount), 0)
  );
  const staffPayments = roundMoney(
    (staffPay ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  );
  const unappliedDeposits = roundMoney(
    (unapplied ?? []).reduce((sum, d) => sum + Number(d.amount), 0)
  );

  // Exclude tender on voided/deleted sales from cash-from-sales
  const paymentSaleIds = [...new Set((salePayments ?? []).map((p) => p.sale_id).filter(Boolean))];
  const livePaymentSaleIds = new Set<string>();
  if (paymentSaleIds.length) {
    for (let i = 0; i < paymentSaleIds.length; i += 200) {
      const chunk = paymentSaleIds.slice(i, i + 200);
      const { data: paySales } = await supabase
        .from("sales")
        .select("id, status, deleted_at")
        .eq("organization_id", org.organizationId)
        .in("id", chunk);
      for (const s of paySales ?? []) {
        if (!s.deleted_at && s.status !== "VOID") livePaymentSaleIds.add(s.id);
      }
    }
  }

  const cashFromSales = roundMoney(
    (salePayments ?? []).reduce((sum, p) => {
      if (p.reference === "APPOINTMENT_DEPOSIT") return sum;
      if (p.sale_id && !livePaymentSaleIds.has(p.sale_id)) return sum;
      return sum + Number(p.amount);
    }, 0)
  );

  const postedSaleIds = new Set((sales ?? []).map((s) => s.id));
  // Only refunds on still-posted tickets reduce P&L (partial refunds). Full void/refund
  // already removed the ticket from salesRevenue — subtracting again would double-count.
  const partialSaleRefunds = roundMoney(
    (periodRefunds ?? [])
      .filter((r) => postedSaleIds.has(r.sale_id))
      .reduce((sum, r) => sum + Number(r.amount), 0)
  );
  const allSaleRefundsCash = roundMoney(
    (periodRefunds ?? []).reduce((sum, r) => sum + Number(r.amount), 0)
  );

  const inventory = await getInventoryMoneySnapshot(
    org.organizationId,
    fromLabel,
    toLabel
  );
  const [productSaleRows, revenueSplit] = await Promise.all([
    getProductSalesBreakdown(org.organizationId, fromLabel, toLabel),
    getRevenueSplit(org.organizationId, fromLabel, toLabel),
  ]);

  const productCogs = inventory.productSales.costOfGoodsSold;
  const productRetailRevenue = inventory.productSales.retailRevenue;
  const productGrossProfit = inventory.productSales.grossProfit;
  const productUnitsSold = inventory.productSales.unitsSold;
  const productMarginPercent = inventory.productSales.marginPercent;
  // Same pre-discount line basis as products/packages — do not mix with ticket totals
  const serviceRevenue = revenueSplit.services;

  const totalInflow = roundMoney(cashFromSales + advancesCollected);
  // Cash outflow excludes non-cash COGS; sale refunds are cash leaving the drawer
  const totalOutflow = roundMoney(totalExpenses + staffPayments + allSaleRefundsCash);
  const netProfit = roundMoney(
    salesRevenue - partialSaleRefunds - totalExpenses - staffPayments - productCogs
  );
  const netCashFlow = roundMoney(totalInflow - totalOutflow);

  const categoryMap: Record<string, number> = {};
  for (const e of operatingRows) {
    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + Number(e.amount);
  }

  return {
    salesRevenue,
    advancesCollected,
    cashFromSales,
    totalExpenses,
    staffPayments,
    productCogs,
    productRetailRevenue,
    productGrossProfit,
    productUnitsSold,
    productMarginPercent,
    serviceRevenue,
    inventoryValueAtCost: inventory.inventoryValueAtCost,
    inventoryValueAtRetail: inventory.inventoryValueAtRetail,
    inventoryUnitsOnHand: inventory.totalUnitsOnHand,
    productSaleRows,
    totalInflow,
    totalOutflow,
    netProfit,
    netCashFlow,
    unappliedDeposits,
    saleCount: sales?.length ?? 0,
    expenseCount: operatingRows.length,
    staffPaymentCount: staffPay?.length ?? 0,
    periodLabel: formatPeriodLabel(fromLabel, toLabel),
    expensesByCategory: Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category: category as ExpenseCategory,
        label: EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category,
        amount: roundMoney(amount),
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function getExpenses(from?: string, to?: string): Promise<ExpenseRow[]> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { fromLabel, toLabel } = parseDateRange(from, to);

  const { data, error } = await supabase
    .from("expenses")
    .select("id, category, amount, description, expense_date, payment_method, created_at")
    .eq("organization_id", org.organizationId)
    .gte("expense_date", fromLabel)
    .lte("expense_date", toLabel)
    .order("expense_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseRow[];
}

const expenseSchema = z.object({
  category: z.enum([
    "RENT",
    "UTILITIES",
    "SUPPLIES",
    "PAYROLL",
    "MARKETING",
    "MAINTENANCE",
    "OTHER",
  ]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
  expense_date: z.string().min(1),
  payment_method: z.enum(["CASH", "CARD", "OTHER"]),
});

export async function createExpense(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
    expense_date: formData.get("expense_date"),
    payment_method: formData.get("payment_method"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("expenses").insert({
    organization_id: org.organizationId,
    category: parsed.data.category,
    amount: parsed.data.amount,
    description: parsed.data.description ?? null,
    expense_date: parsed.data.expense_date,
    payment_method: parsed.data.payment_method,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { success: true, recordDate: parsed.data.expense_date };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getUnappliedDepositTotal(appointmentId: string): Promise<number> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data } = await supabase
    .from("appointment_deposits")
    .select("amount")
    .eq("organization_id", org.organizationId)
    .eq("appointment_id", appointmentId)
    .eq("status", "APPROVED")
    .is("applied_to_sale_id", null);

  return roundMoney((data ?? []).reduce((sum, d) => sum + Number(d.amount), 0));
}
