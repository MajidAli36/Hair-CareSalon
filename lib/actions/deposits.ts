"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  calculateRequiredAdvance,
  getApprovedDepositTotal,
  getPendingDepositTotal,
  sumServicePrices,
  type DepositLine,
} from "@/lib/booking/pricing";
import type { ActionResult } from "@/types/commerce";

const refundSchema = z.object({
  depositId: z.string().uuid(),
  reason: z.string().min(3, "Please enter a refund reason"),
  refundMethod: z.enum(["CASH", "CARD", "OTHER"]),
  refundReference: z.string().optional(),
});

async function getAppointmentAdvanceContext(appointmentId: string, organizationId: string) {
  const supabase = await createClient();

  const [{ data: appt }, { data: services }, { data: org }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, source, status")
      .eq("id", appointmentId)
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("appointment_services")
      .select("price")
      .eq("appointment_id", appointmentId),
    supabase
      .from("organizations")
      .select("booking_advance_amount, booking_advance_percent")
      .eq("id", organizationId)
      .single(),
  ]);

  const serviceTotal = sumServicePrices(services ?? []);
  const requiredAdvance =
    appt?.source === "ONLINE" && org
      ? calculateRequiredAdvance(serviceTotal, org)
      : 0;

  return { appt, serviceTotal, requiredAdvance };
}

export async function syncAppointmentAfterDepositChange(
  appointmentId: string,
  organizationId: string
) {
  const supabase = await createClient();
  const { data: deposits } = await supabase
    .from("appointment_deposits")
    .select("amount, status, applied_to_sale_id")
    .eq("appointment_id", appointmentId)
    .eq("organization_id", organizationId);

  const rows = (deposits ?? []) as DepositLine[];
  const pending = getPendingDepositTotal(rows);
  const approved = getApprovedDepositTotal(rows);
  const { appt, requiredAdvance } = await getAppointmentAdvanceContext(
    appointmentId,
    organizationId
  );

  if (!appt || appt.status === "CANCELLED" || appt.status === "COMPLETED") return;

  if (pending > 0) {
    await supabase
      .from("appointments")
      .update({ status: "SCHEDULED" })
      .eq("id", appointmentId);
    return;
  }

  if (appt.source === "ONLINE" && requiredAdvance > 0) {
    if (approved >= requiredAdvance) {
      await supabase
        .from("appointments")
        .update({ status: "CONFIRMED" })
        .eq("id", appointmentId);
    } else if (approved === 0) {
      await supabase
        .from("appointments")
        .update({ status: "SCHEDULED" })
        .eq("id", appointmentId);
    }
    return;
  }

  if (approved > 0) {
    await supabase
      .from("appointments")
      .update({ status: "CONFIRMED" })
      .eq("id", appointmentId);
  }
}

export async function revertAppointmentDeposit(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = refundSchema.safeParse({
    depositId: formData.get("depositId"),
    reason: formData.get("reason"),
    refundMethod: formData.get("refundMethod"),
    refundReference: (formData.get("refundReference") as string) || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deposit, error: fetchErr } = await supabase
    .from("appointment_deposits")
    .select("id, appointment_id, amount, status, applied_to_sale_id")
    .eq("id", parsed.data.depositId)
    .eq("organization_id", org.organizationId)
    .single();

  if (fetchErr || !deposit) return { error: "Deposit not found" };
  if (deposit.status !== "APPROVED") {
    return { error: "Only approved advances can be reverted" };
  }
  if (deposit.applied_to_sale_id) {
    return { error: "This advance was already used at POS — void the sale to restore it" };
  }

  const { error: updateErr } = await supabase
    .from("appointment_deposits")
    .update({
      status: "REFUNDED",
      refund_reason: parsed.data.reason,
      refund_method: parsed.data.refundMethod,
      refund_reference: parsed.data.refundReference ?? null,
      refunded_at: new Date().toISOString(),
      refunded_by: user?.id ?? null,
    })
    .eq("id", deposit.id);

  if (updateErr) return { error: updateErr.message };

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("expenses").insert({
    organization_id: org.organizationId,
    category: "OTHER",
    amount: Number(deposit.amount),
    description: `Advance refund to customer — ${parsed.data.reason}`,
    expense_date: today,
    payment_method: parsed.data.refundMethod,
    created_by: user?.id ?? null,
  });

  await syncAppointmentAfterDepositChange(deposit.appointment_id, org.organizationId);

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "deposit.refund",
    entityType: "appointment_deposit",
    entityId: deposit.id,
    metadata: {
      appointmentId: deposit.appointment_id,
      amount: deposit.amount,
      refundMethod: parsed.data.refundMethod,
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function assertCanAddDeposit(
  appointmentId: string,
  organizationId: string,
  amount: number
): Promise<ActionResult> {
  if (amount <= 0) return { success: true };

  const supabase = await createClient();
  const { data: deposits } = await supabase
    .from("appointment_deposits")
    .select("amount, status, applied_to_sale_id")
    .eq("appointment_id", appointmentId)
    .eq("organization_id", organizationId);

  const rows = (deposits ?? []) as DepositLine[];
  if (getPendingDepositTotal(rows) > 0) {
    return {
      error:
        "A customer advance is already awaiting approval. Approve or reject it before adding another.",
    };
  }

  const { appt, requiredAdvance } = await getAppointmentAdvanceContext(
    appointmentId,
    organizationId
  );

  if (!appt) return { error: "Appointment not found" };

  const approved = getApprovedDepositTotal(rows);
  if (appt.source === "ONLINE" && requiredAdvance > 0 && approved >= requiredAdvance) {
    return {
      error:
        "Advance for this online booking is already complete. Revert the existing advance first if you need to change it.",
    };
  }

  if (approved > 0 && appt.source === "STAFF") {
    return {
      error:
        "Advance already recorded for this appointment. Revert it first if you need to adjust.",
    };
  }

  return { success: true };
}
