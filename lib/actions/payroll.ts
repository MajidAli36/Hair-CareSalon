"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";
import type { StaffPaymentType } from "@/lib/finances/categories";

export type StaffPaymentRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  amount: number;
  payment_type: StaffPaymentType;
  payment_method: string;
  payment_date: string;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
  amount_due: number | null;
  notes: string | null;
};

const paymentSchema = z.object({
  staff_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  payment_type: z.enum(["SALARY", "PARTIAL", "ADVANCE", "BONUS"]),
  payment_method: z.enum(["CASH", "CARD", "OTHER"]),
  payment_date: z.string().min(1),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  amount_due: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export async function getStaffPayments(from?: string, to?: string): Promise<StaffPaymentRow[]> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  let query = supabase
    .from("staff_payments")
    .select(
      `
      id,
      staff_id,
      amount,
      payment_type,
      payment_method,
      payment_date,
      paid_at,
      period_start,
      period_end,
      amount_due,
      notes,
      staff:staff(full_name)
    `
    )
    .eq("organization_id", org.organizationId)
    .order("paid_at", { ascending: false });

  if (from) query = query.gte("payment_date", from);
  if (to) query = query.lte("payment_date", to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const staff = row.staff as unknown as { full_name: string } | null;
    return {
      id: row.id,
      staff_id: row.staff_id,
      staff_name: staff?.full_name ?? "Staff",
      amount: Number(row.amount),
      payment_type: row.payment_type as StaffPaymentType,
      payment_method: row.payment_method,
      payment_date: row.payment_date,
      paid_at: row.paid_at,
      period_start: row.period_start,
      period_end: row.period_end,
      amount_due: row.amount_due != null ? Number(row.amount_due) : null,
      notes: row.notes,
    };
  });
}

export async function getStaffPaymentTotals(from?: string, to?: string): Promise<number> {
  const rows = await getStaffPayments(from, to);
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export async function createStaffPayment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = paymentSchema.safeParse({
    staff_id: formData.get("staff_id"),
    amount: formData.get("amount"),
    payment_type: formData.get("payment_type"),
    payment_method: formData.get("payment_method"),
    payment_date: formData.get("payment_date"),
    period_start: (formData.get("period_start") as string) || undefined,
    period_end: (formData.get("period_end") as string) || undefined,
    amount_due: formData.get("amount_due") || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (
    parsed.data.payment_type === "PARTIAL" &&
    parsed.data.amount_due &&
    parsed.data.amount > parsed.data.amount_due
  ) {
    return { error: "Partial payment cannot exceed total amount due" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const paidAt = formData.get("paid_at") as string;
  const paidAtIso = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();

  const { error } = await supabase.from("staff_payments").insert({
    organization_id: org.organizationId,
    staff_id: parsed.data.staff_id,
    amount: parsed.data.amount,
    payment_type: parsed.data.payment_type,
    payment_method: parsed.data.payment_method,
    payment_date: parsed.data.payment_date,
    paid_at: paidAtIso,
    period_start: parsed.data.period_start ?? null,
    period_end: parsed.data.period_end ?? null,
    amount_due: parsed.data.amount_due ?? null,
    notes: parsed.data.notes ?? null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  revalidatePath("/staff");
  return { success: true, recordDate: parsed.data.payment_date };
}

export async function deleteStaffPayment(paymentId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { error } = await supabase
    .from("staff_payments")
    .delete()
    .eq("id", paymentId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getStaffPaymentSummaryByStaff(staffId: string) {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_payments")
    .select("amount, payment_type, amount_due, payment_date")
    .eq("organization_id", org.organizationId)
    .eq("staff_id", staffId)
    .order("payment_date", { ascending: false });

  const totalPaid = (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const partialRows = (data ?? []).filter((r) => r.payment_type === "PARTIAL" && r.amount_due);
  const lastPartial = partialRows[0];
  const remaining =
    lastPartial?.amount_due != null
      ? Math.max(0, Number(lastPartial.amount_due) - Number(lastPartial.amount))
      : 0;

  return { totalPaid, paymentCount: data?.length ?? 0, remainingBalance: remaining };
}
