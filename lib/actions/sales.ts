"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/log";
import { queueDeviceCommand, findDeviceByType } from "@/lib/devices/helpers";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, CheckoutPayload, SaleStatus } from "@/types/commerce";
import type { Sale } from "@/types";

async function nextInvoiceNumber(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  return `INV-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

export async function completeCheckout(
  payload: CheckoutPayload
): Promise<{ error?: string; saleId?: string }> {
  const org = await requireMinimumRole("CASHIER");

  if (!payload.items.length) {
    return { error: "Cart is empty" };
  }

  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const discount = Math.min(Math.max(0, payload.discount), subtotal);
  const tax = Math.max(0, payload.tax ?? 0);
  const total = Math.max(0, subtotal - discount + tax);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let depositApplied = 0;
  let depositRows: { id: string; amount: number }[] = [];

  if (payload.appointmentId) {
    const { data: deposits } = await supabase
      .from("appointment_deposits")
      .select("id, amount")
      .eq("organization_id", org.organizationId)
      .eq("appointment_id", payload.appointmentId)
      .eq("status", "APPROVED")
      .is("applied_to_sale_id", null);

    depositRows = deposits ?? [];
    const availableDeposit = depositRows.reduce((sum, d) => sum + Number(d.amount), 0);
    depositApplied = Math.min(availableDeposit, total);
  } else if (payload.customerId) {
    const { data: customerDeposits } = await supabase
      .from("appointment_deposits")
      .select("id, amount, appointment_id")
      .eq("organization_id", org.organizationId)
      .eq("status", "APPROVED")
      .is("applied_to_sale_id", null);

    if (customerDeposits?.length) {
      const apptIds = [...new Set(customerDeposits.map((d) => d.appointment_id))];
      const { data: appts } = await supabase
        .from("appointments")
        .select("id")
        .eq("organization_id", org.organizationId)
        .eq("customer_id", payload.customerId)
        .in("id", apptIds)
        .not("status", "in", '("COMPLETED","CANCELLED","NO_SHOW")');

      const validApptIds = new Set((appts ?? []).map((a) => a.id));
      const rows = customerDeposits.filter((d) => validApptIds.has(d.appointment_id));
      if (rows.length > 0) {
        const grouped = new Map<string, typeof rows>();
        for (const row of rows) {
          const list = grouped.get(row.appointment_id) ?? [];
          list.push(row);
          grouped.set(row.appointment_id, list);
        }
        if (grouped.size === 1) {
          const [, onlyRows] = [...grouped.entries()][0];
          depositRows = onlyRows.map((r) => ({ id: r.id, amount: Number(r.amount) }));
          const availableDeposit = depositRows.reduce((sum, d) => sum + d.amount, 0);
          depositApplied = Math.min(availableDeposit, total);
          payload.appointmentId = onlyRows[0].appointment_id;
        }
      }
    }
  }

  const linkedAppointmentId = payload.appointmentId || null;

  const amountDue = Math.max(0, total - depositApplied);

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      organization_id: org.organizationId,
      customer_id: payload.customerId || null,
      appointment_id: linkedAppointmentId,
      status: "COMPLETED",
      subtotal,
      discount,
      tax,
      total,
      deposit_applied: depositApplied,
      notes: payload.notes ?? null,
      created_by: user?.id ?? null,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (saleError || !sale) return { error: saleError?.message ?? "Failed to create sale" };

  const saleItems = payload.items.map((item) => ({
    organization_id: org.organizationId,
    sale_id: sale.id,
    item_type: item.itemType,
    item_id: item.itemId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.unitPrice * item.quantity,
  }));

  const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
  if (itemsError) return { error: itemsError.message };

  const invoiceNumber = await nextInvoiceNumber(org.organizationId);
  const { error: invoiceError } = await supabase.from("invoices").insert({
    organization_id: org.organizationId,
    sale_id: sale.id,
    invoice_number: invoiceNumber,
  });
  if (invoiceError) return { error: invoiceError.message };

  if (amountDue > 0) {
    const { error: paymentError } = await supabase.from("payments").insert({
      organization_id: org.organizationId,
      sale_id: sale.id,
      amount: amountDue,
      method: payload.paymentMethod,
    });
    if (paymentError) return { error: paymentError.message };
  }

  if (depositApplied > 0) {
    const { error: depositPaymentError } = await supabase.from("payments").insert({
      organization_id: org.organizationId,
      sale_id: sale.id,
      amount: depositApplied,
      method: "OTHER",
      reference: "APPOINTMENT_DEPOSIT",
    });
    if (depositPaymentError) return { error: depositPaymentError.message };

    let remaining = depositApplied;
    for (const deposit of depositRows) {
      if (remaining <= 0) break;
      const applyAmount = Math.min(remaining, Number(deposit.amount));
      await supabase
        .from("appointment_deposits")
        .update({ applied_to_sale_id: sale.id })
        .eq("id", deposit.id)
        .eq("organization_id", org.organizationId);
      remaining -= applyAmount;
    }
  }

  for (const item of payload.items.filter((i) => i.itemType === "PRODUCT")) {
    await supabase.from("inventory_transactions").insert({
      organization_id: org.organizationId,
      product_id: item.itemId,
      type: "OUT",
      quantity: item.quantity,
      reference_type: "sale",
      reference_id: sale.id,
      created_by: user?.id ?? null,
    });
  }

  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath("/finances");
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/products");

  try {
    if (payload.paymentMethod === "CASH" && amountDue > 0) {
      const drawerId = await findDeviceByType(org.organizationId, "DRAWER");
      if (drawerId) {
        await queueDeviceCommand(org.organizationId, drawerId, "OPEN_DRAWER", { saleId: sale.id });
      }
    }
    const printerId = await findDeviceByType(org.organizationId, "PRINTER");
    if (printerId) {
      await queueDeviceCommand(org.organizationId, printerId, "PRINT_RECEIPT", { saleId: sale.id });
    }
  } catch {
    // Device commands are optional — sale already saved
  }

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "sale.complete",
    entityType: "sale",
    entityId: sale.id,
    metadata: { total, itemCount: payload.items.length, depositApplied, amountDue },
  });

  return { saleId: sale.id };
}

export async function voidSale(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { error } = await supabase
    .from("sales")
    .update({
      status: "VOID",
      voided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .eq("status", "COMPLETED");

  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "sale.void",
    entityType: "sale",
    entityId: id,
  });

  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath(`/sales/${id}`);
  return { success: true };
}

export async function getSales(status?: SaleStatus) {
  const org = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("sales")
    .select(`
      *,
      customer:customers(id, first_name, last_name),
      invoice:invoices(invoice_number)
    `)
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as unknown as (Sale & {
    customer: { id: string; first_name: string; last_name: string | null } | null;
    invoice: { invoice_number: string } | { invoice_number: string }[] | null;
  })[];
}

export async function getSale(id: string) {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales")
    .select(`
      *,
      customer:customers(id, first_name, last_name, phone, email),
      items:sale_items(*),
      invoice:invoices(*),
      payments(*)
    `)
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .single();

  if (error) return null;
  return data as unknown as Sale & {
    customer: { id: string; first_name: string; last_name: string | null; phone: string | null; email: string | null } | null;
    items: { id: string; name: string; item_type: string; quantity: number; unit_price: number; line_total: number }[];
    invoice: { invoice_number: string; issued_at: string } | { invoice_number: string; issued_at: string }[] | null;
    payments: { method: string; amount: number; paid_at: string }[];
  };
}

export async function getTodaySalesTotal() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return getSalesTotalForDateRange(start, new Date());
}

export async function getSalesTotalForDateRange(start: Date, end: Date) {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales")
    .select("total")
    .eq("organization_id", org.organizationId)
    .eq("status", "COMPLETED")
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  if (error) return 0;
  return data.reduce((sum, s) => sum + Number(s.total), 0);
}

export async function checkoutAndRedirect(payload: CheckoutPayload) {
  const result = await completeCheckout(payload);
  if (result.error) return { error: result.error };
  if (result.saleId) redirect(`/sales/${result.saleId}`);
  return { error: "Unknown error" };
}
