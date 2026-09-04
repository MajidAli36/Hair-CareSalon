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
import { hasMinimumRole } from "@/lib/permissions/roles";
import { roundMoney } from "@/lib/sales/calculate";
import {
  computeSalePaymentState,
  validateCheckoutPayments,
} from "@/lib/sales/payment-balance";
import { syncSalePaymentDenorm } from "@/lib/sales/sync-payment-denorm";

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
): Promise<{ error?: string; saleId?: string; changeGiven?: number; amountDue?: number }> {
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

  const paymentLines =
    payload.payments?.filter((p) => roundMoney(p.amount) > 0) ??
    (payload.amountReceived != null
      ? [{ amount: roundMoney(payload.amountReceived), method: payload.paymentMethod }]
      : amountDue > 0
        ? [{ amount: amountDue, method: payload.paymentMethod }]
        : []);

  const isManager = hasMinimumRole(org.role, "MANAGER");
  const checkoutCheck = validateCheckoutPayments({
    customerId: payload.customerId,
    amountDueAfterDeposit: amountDue,
    payments: paymentLines,
    allowUnpaid: Boolean(payload.allowUnpaid),
    isManager,
  });
  if (!checkoutCheck.ok) return { error: checkoutCheck.error };

  const collectedNow = checkoutCheck.collected;
  const tendered =
    payload.tenderedAmount != null
      ? roundMoney(payload.tenderedAmount)
      : collectedNow;
  if (tendered + 0.009 < collectedNow) {
    return { error: "Tendered amount cannot be less than amount received" };
  }
  const changeGiven = roundMoney(Math.max(0, tendered - collectedNow));

  const paymentsSumAtComplete = roundMoney(collectedNow + depositApplied);
  const paymentState = computeSalePaymentState({
    total,
    paymentsSum: paymentsSumAtComplete,
    refundsSum: 0,
    saleStatus: "COMPLETED",
  });

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      organization_id: org.organizationId,
      customer_id: payload.customerId || null,
      appointment_id: linkedAppointmentId,
      staff_id: payload.staffId || null,
      status: "COMPLETED",
      subtotal,
      discount,
      tax,
      total,
      deposit_applied: depositApplied,
      amount_paid: paymentState.amountPaid,
      amount_refunded: 0,
      amount_due: paymentState.amountDue,
      payment_status: paymentState.paymentStatus,
      payment_version: 1,
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

  let remainingTender = tendered;
  for (let i = 0; i < paymentLines.length; i++) {
    const line = paymentLines[i];
    const amt = roundMoney(line.amount);
    if (amt <= 0) continue;
    const isLast = i === paymentLines.length - 1;
    const lineTendered = isLast ? remainingTender : amt;
    const lineChange = isLast ? roundMoney(Math.max(0, lineTendered - amt)) : 0;
    remainingTender = roundMoney(Math.max(0, remainingTender - amt));
    const { error: paymentError } = await supabase.from("payments").insert({
      organization_id: org.organizationId,
      sale_id: sale.id,
      amount: amt,
      method: line.method,
      created_by: user?.id ?? null,
      tendered_amount: line.method === "CASH" ? lineTendered : null,
      change_given: line.method === "CASH" ? lineChange : null,
      notes: paymentState.amountDue > 0 ? "Partial payment at checkout" : null,
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
      created_by: user?.id ?? null,
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

  try {
    await syncSalePaymentDenorm(org.organizationId, sale.id);
  } catch {
    /* denorm already set on insert */
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
  if (payload.customerId) revalidatePath(`/customers/${payload.customerId}`);

  try {
    if (
      (paymentLines.some((p) => p.method === "CASH") || payload.paymentMethod === "CASH") &&
      collectedNow > 0
    ) {
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
    metadata: {
      total,
      itemCount: payload.items.length,
      depositApplied,
      amountDue,
      collectedNow,
      remainingDue: paymentState.amountDue,
      changeGiven,
      paymentStatus: paymentState.paymentStatus,
    },
  });

  return { saleId: sale.id, changeGiven, amountDue: paymentState.amountDue };
}

export async function voidSale(
  id: string,
  reason?: string
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const voidReason = (reason ?? "").trim();
  if (voidReason.length < 3) {
    return { error: "Void reason is required (min 3 characters)" };
  }

  const { data: sale } = await supabase
    .from("sales")
    .select("id, status, total")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .single();

  if (!sale) return { error: "Sale not found" };
  if (sale.status !== "COMPLETED" && sale.status !== "AMENDED") {
    return { error: "Only completed invoices can be voided" };
  }

  const { data: items } = await supabase
    .from("sale_items")
    .select("item_type, item_id, quantity")
    .eq("sale_id", id)
    .eq("organization_id", org.organizationId);

  // Reverse product stock (IN). Managers can insert IN transactions.
  for (const item of (items ?? []).filter((i) => i.item_type === "PRODUCT")) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    const { error: invErr } = await supabase.from("inventory_transactions").insert({
      organization_id: org.organizationId,
      product_id: item.item_id,
      type: "IN",
      quantity: qty,
      reference_type: "sale_void",
      reference_id: id,
      notes: `Void restore — ${voidReason}`,
      created_by: user?.id ?? null,
    });
    if (invErr) return { error: `Inventory restore failed: ${invErr.message}` };
  }

  // Unlink applied deposits so they can be reused or refunded separately
  await supabase
    .from("appointment_deposits")
    .update({ applied_to_sale_id: null })
    .eq("applied_to_sale_id", id)
    .eq("organization_id", org.organizationId);

  // Reconcile net collected as a full void refund (append-only; do not delete payments)
  const [{ data: pays }, { data: refs }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("sale_id", id)
      .eq("organization_id", org.organizationId),
    supabase
      .from("sale_refunds")
      .select("amount")
      .eq("sale_id", id)
      .eq("organization_id", org.organizationId),
  ]);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const refunded = (refs ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const netCollected = Math.round((paid - refunded) * 100) / 100;
  if (netCollected > 0) {
    const { error: refundErr } = await supabase.from("sale_refunds").insert({
      organization_id: org.organizationId,
      sale_id: id,
      amount: netCollected,
      method: "CASH",
      reason: `Void — ${voidReason}`,
      reference: "SALE_VOID",
      created_by: user?.id ?? null,
    });
    if (refundErr) return { error: `Void refund failed: ${refundErr.message}` };

    await supabase.from("expenses").insert({
      organization_id: org.organizationId,
      category: "OTHER",
      amount: netCollected,
      description: `Voided invoice refund — ${voidReason}`,
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: "CASH",
      created_by: user?.id ?? null,
    });
  }

  const { error } = await supabase
    .from("sales")
    .update({
      status: "VOID",
      voided_at: new Date().toISOString(),
      void_reason: voidReason,
      voided_by: user?.id ?? null,
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .in("status", ["COMPLETED", "AMENDED"]);

  if (error) return { error: error.message };

  try {
    await syncSalePaymentDenorm(org.organizationId, id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to sync payment status" };
  }

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "sale.void",
    entityType: "sale",
    entityId: id,
    metadata: { reason: voidReason, total: sale.total },
  });

  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath("/finances");
  revalidatePath("/products");
  revalidatePath(`/sales/${id}`);
  return { success: true };
}

export async function getSales(
  statusOrOptions?: SaleStatus | { status?: SaleStatus; search?: string }
) {
  const org = await requireOrganization();
  const supabase = await createClient();
  const options =
    typeof statusOrOptions === "string"
      ? { status: statusOrOptions }
      : statusOrOptions ?? {};
  const { status, search } = options;

  let saleIds: string[] | null = null;

  if (search?.trim()) {
    const term = search.trim();
    const safe = term.replace(/[%_,]/g, " ").trim();
    if (!safe) return [];
    const like = `%${safe}%`;

    const [{ data: customers }, { data: invoices }] = await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null)
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`
        ),
      supabase
        .from("invoices")
        .select("sale_id")
        .eq("organization_id", org.organizationId)
        .ilike("invoice_number", like),
    ]);

    const ids = new Set<string>();
    for (const inv of invoices ?? []) {
      if (inv.sale_id) ids.add(inv.sale_id);
    }

    const customerIds = (customers ?? []).map((c) => c.id);
    if (customerIds.length) {
      for (let i = 0; i < customerIds.length; i += 200) {
        const chunk = customerIds.slice(i, i + 200);
        const { data: linked } = await supabase
          .from("sales")
          .select("id")
          .eq("organization_id", org.organizationId)
          .in("customer_id", chunk);
        for (const row of linked ?? []) ids.add(row.id);
      }
    }

    const { data: noteHits } = await supabase
      .from("sales")
      .select("id")
      .eq("organization_id", org.organizationId)
      .ilike("notes", like);
    for (const row of noteHits ?? []) ids.add(row.id);

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) {
      ids.add(term);
    }

    saleIds = [...ids];
    if (saleIds.length === 0) return [];
  }

  let query = supabase
    .from("sales")
    .select(`
      *,
      customer:customers(id, first_name, last_name, phone),
      invoice:invoices(invoice_number)
    `)
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (saleIds) query = query.in("id", saleIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as unknown as (Sale & {
    customer: {
      id: string;
      first_name: string;
      last_name: string | null;
      phone: string | null;
    } | null;
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
    customer_id: string | null;
    current_version?: number;
    void_reason?: string | null;
    notes: string | null;
    customer: { id: string; first_name: string; last_name: string | null; phone: string | null; email: string | null } | null;
    items: {
      id: string;
      name: string;
      item_type: string;
      item_id: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[];
    invoice: { invoice_number: string; issued_at: string } | { invoice_number: string; issued_at: string }[] | null;
    payments: { method: string; amount: number; paid_at: string; reference?: string | null }[];
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
    .in("status", ["COMPLETED", "AMENDED"])
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
