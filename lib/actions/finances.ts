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

export async function getFinancialSummary(from?: string, to?: string): Promise<FinancialSummary> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { start, end, fromLabel, toLabel } = parseDateRange(from, to);

  const [{ data: sales }, { data: deposits }, { data: expenses }, { data: unapplied }, { data: staffPay }] =
    await Promise.all([
      supabase
        .from("sales")
        .select("total")
        .eq("organization_id", org.organizationId)
        .eq("status", "COMPLETED")
        .gte("completed_at", start.toISOString())
        .lte("completed_at", end.toISOString()),
      supabase
        .from("appointment_deposits")
        .select("amount")
        .eq("organization_id", org.organizationId)
        .eq("status", "APPROVED")
        .gte("paid_at", start.toISOString())
        .lte("paid_at", end.toISOString()),
      supabase
        .from("expenses")
        .select("category, amount")
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
    ]);

  const salesRevenue = (sales ?? []).reduce((sum, s) => sum + Number(s.total), 0);
  const advancesCollected = (deposits ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const staffPayments = (staffPay ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const unappliedDeposits = (unapplied ?? []).reduce((sum, d) => sum + Number(d.amount), 0);

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
  const serviceRevenue = Math.max(
    0,
    salesRevenue - productRetailRevenue - revenueSplit.packages
  );

  const totalInflow = salesRevenue + advancesCollected;
  const totalOutflow = totalExpenses + staffPayments + productCogs;
  const netProfit = salesRevenue - totalExpenses - staffPayments - productCogs;
  const netCashFlow = totalInflow - totalOutflow;

  const categoryMap: Record<string, number> = {};
  for (const e of expenses ?? []) {
    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + Number(e.amount);
  }

  return {
    salesRevenue,
    advancesCollected,
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
    expenseCount: expenses?.length ?? 0,
    staffPaymentCount: staffPay?.length ?? 0,
    periodLabel: formatPeriodLabel(fromLabel, toLabel),
    expensesByCategory: Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category: category as ExpenseCategory,
        label: EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category,
        amount,
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
    .is("applied_to_sale_id", null);

  return (data ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
}
