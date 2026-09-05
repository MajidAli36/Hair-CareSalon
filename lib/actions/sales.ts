"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/log";
import { queueDeviceCommand, findDeviceByType } from "@/lib/devices/helpers";
import { queueOpenCashDrawer } from "@/lib/devices/cash-drawer";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, CheckoutPayload, SaleStatus } from "@/types/commerce";
import type { Sale } from "@/types";
import { hasMinimumRole } from "@/lib/permissions/roles";
import { calculateInvoiceTotals, roundMoney } from "@/lib/sales/calculate";
import {
  computeSalePaymentState,
  validateCheckoutPayments,
} from "@/lib/sales/payment-balance";
import { syncSalePaymentDenorm } from "@/lib/sales/sync-payment-denorm";
import { formatCurrency } from "@/lib/format";

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

  const totals = calculateInvoiceTotals(
    payload.items.map((item) => ({
      itemType: item.itemType,
      itemId: item.itemId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
    payload.discount,
    payload.tax ?? 0
  );
  const { subtotal, discount, tax, total } = totals;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fail closed on oversell before creating the sale
  const productLines = payload.items.filter((i) => i.itemType === "PRODUCT");
  const productCostById = new Map<string, number>();
  if (productLines.length) {
    const productIds = [...new Set(productLines.map((i) => i.itemId))];
    const { data: stockRows } = await supabase
      .from("products")
      .select("id, name, stock_quantity, cost_price")
      .eq("organization_id", org.organizationId)
      .in("id", productIds);
    const stockMap = new Map(
      (stockRows ?? []).map((p) => [
        p.id,
        {
          name: p.name,
          stock: Number(p.stock_quantity) || 0,
          cost: Number(p.cost_price) || 0,
        },
      ])
    );
    const needed = new Map<string, number>();
    for (const line of productLines) {
      needed.set(line.itemId, (needed.get(line.itemId) ?? 0) + Number(line.quantity));
    }
    for (const [productId, qty] of needed) {
      const row = stockMap.get(productId);
      if (!row) return { error: "A product in the cart was not found" };
      productCostById.set(productId, row.cost);
      if (qty > row.stock) {
        return {
          error: `Insufficient stock for ${row.name} (have ${row.stock}, need ${qty})`,
        };
      }
    }
  }

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
    const availableDeposit = roundMoney(
      depositRows.reduce((sum, d) => sum + Number(d.amount), 0)
    );
    depositApplied = roundMoney(Math.min(availableDeposit, total));
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
          const availableDeposit = roundMoney(
            depositRows.reduce((sum, d) => sum + d.amount, 0)
          );
          depositApplied = roundMoney(Math.min(availableDeposit, total));
          payload.appointmentId = onlyRows[0].appointment_id;
        }
      }
    }
  }

  const linkedAppointmentId = payload.appointmentId || null;

  const amountDue = roundMoney(Math.max(0, total - depositApplied));

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

  const selectedStaffIds = [
    ...new Set(
      (payload.staffIds?.length
        ? payload.staffIds
        : payload.staffId
          ? [payload.staffId]
          : []
      ).filter((id): id is string => Boolean(id))
    ),
  ];
  const primaryStaffId = selectedStaffIds[0] ?? null;

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      organization_id: org.organizationId,
      customer_id: payload.customerId || null,
      appointment_id: linkedAppointmentId,
      staff_id: primaryStaffId,
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

  const saleItems = totals.lines.map((item) => ({
    organization_id: org.organizationId,
    sale_id: sale.id,
    item_type: item.itemType,
    item_id: item.itemId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.lineTotal,
    unit_cost:
      item.itemType === "PRODUCT" ? roundMoney(productCostById.get(item.itemId) ?? 0) : 0,
  }));

  const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
  if (itemsError) return { error: itemsError.message };

  if (selectedStaffIds.length > 0) {
    const { error: saleStaffError } = await supabase.from("sale_staff").insert(
      selectedStaffIds.map((staffId) => ({
        sale_id: sale.id,
        staff_id: staffId,
        organization_id: org.organizationId,
      }))
    );
    if (saleStaffError) return { error: saleStaffError.message };
  }

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
      const depositAmt = roundMoney(Number(deposit.amount));
      const applyAmount = roundMoney(Math.min(remaining, depositAmt));
      if (applyAmount <= 0) continue;

      if (applyAmount < depositAmt) {
        // Partial consume: shrink applied row and keep leftover as a new unused deposit
        const { error: shrinkErr } = await supabase
          .from("appointment_deposits")
          .update({
            amount: applyAmount,
            applied_to_sale_id: sale.id,
          })
          .eq("id", deposit.id)
          .eq("organization_id", org.organizationId);
        if (shrinkErr) return { error: shrinkErr.message };

        const { data: original } = await supabase
          .from("appointment_deposits")
          .select(
            "appointment_id, method, notes, status, payment_reference, proof_path, approved_at, approved_by, paid_at, created_by"
          )
          .eq("id", deposit.id)
          .eq("organization_id", org.organizationId)
          .maybeSingle();

        if (original) {
          const leftover = roundMoney(depositAmt - applyAmount);
          const { error: leftoverErr } = await supabase.from("appointment_deposits").insert({
            organization_id: org.organizationId,
            appointment_id: original.appointment_id,
            amount: leftover,
            method: original.method,
            notes: original.notes
              ? `${original.notes} (leftover after sale apply)`
              : "Leftover after partial apply to sale",
            status: original.status,
            payment_reference: original.payment_reference,
            proof_path: original.proof_path,
            approved_at: original.approved_at,
            approved_by: original.approved_by,
            applied_to_sale_id: null,
            paid_at: original.paid_at,
            created_by: original.created_by,
          });
          if (leftoverErr) return { error: leftoverErr.message };
        }
      } else {
        const { error: applyErr } = await supabase
          .from("appointment_deposits")
          .update({ applied_to_sale_id: sale.id })
          .eq("id", deposit.id)
          .eq("organization_id", org.organizationId);
        if (applyErr) return { error: applyErr.message };
      }
      remaining = roundMoney(remaining - applyAmount);
    }
  }

  try {
    await syncSalePaymentDenorm(org.organizationId, sale.id);
  } catch {
    /* denorm already set on insert */
  }

  for (const item of payload.items.filter((i) => i.itemType === "PRODUCT")) {
    const { error: invErr } = await supabase.from("inventory_transactions").insert({
      organization_id: org.organizationId,
      product_id: item.itemId,
      type: "OUT",
      quantity: item.quantity,
      reference_type: "sale",
      reference_id: sale.id,
      created_by: user?.id ?? null,
    });
    if (invErr) {
      return {
        error: `Sale saved but stock update failed for a product: ${invErr.message}. Void this invoice or adjust inventory.`,
        saleId: sale.id,
      };
    }
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
      await queueOpenCashDrawer(org.organizationId, { saleId: sale.id, source: "checkout" });
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
      summary: `Checkout · ${formatCurrency(total)} · ${payload.items.length} item${
        payload.items.length === 1 ? "" : "s"
      }${paymentState.amountDue > 0 ? ` · due ${formatCurrency(paymentState.amountDue)}` : ""}`,
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
    .select("id, status, total, customer_id")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!sale) return { error: "Sale not found" };
  if (sale.status !== "COMPLETED" && sale.status !== "AMENDED") {
    return { error: "Only completed invoices can be voided" };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("sale_id", id)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

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

  // Reconcile cash/card collected on void — do NOT cash-refund deposit applications
  // (those deposits are unlinked above so the advance can be reused).
  const [{ data: pays }, { data: refs }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, method, reference")
      .eq("sale_id", id)
      .eq("organization_id", org.organizationId),
    supabase
      .from("sale_refunds")
      .select("amount")
      .eq("sale_id", id)
      .eq("organization_id", org.organizationId),
  ]);
  const cashCollected = (pays ?? []).reduce((s, p) => {
    if (p.reference === "APPOINTMENT_DEPOSIT") return s;
    return s + Number(p.amount);
  }, 0);
  const refunded = (refs ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const netCashToRefund = roundMoney(Math.max(0, cashCollected - refunded));
  if (netCashToRefund > 0) {
    const { error: refundErr } = await supabase.from("sale_refunds").insert({
      organization_id: org.organizationId,
      sale_id: id,
      amount: netCashToRefund,
      method: "CASH",
      reason: `Void — ${voidReason}`,
      reference: "SALE_VOID",
      created_by: user?.id ?? null,
    });
    if (refundErr) return { error: `Void refund failed: ${refundErr.message}` };

    // Do NOT insert an expenses row — void removes the sale from ticket revenue.
    // Booking refunds as both lost revenue and expense double-hits net profit.
  }

  const { resolveSoftDeleteActor, softDeletePatch } = await import("@/lib/db/soft-delete");
  const actor = await resolveSoftDeleteActor();
  const soft = softDeletePatch(actor);

  const { error } = await supabase
    .from("sales")
    .update({
      status: "VOID",
      voided_at: new Date().toISOString(),
      void_reason: voidReason,
      voided_by: user?.id ?? null,
      ...soft,
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .in("status", ["COMPLETED", "AMENDED"]);

  if (error) return { error: error.message };

  if (invoice?.id) {
    await supabase
      .from("invoices")
      .update(soft)
      .eq("id", invoice.id)
      .eq("organization_id", org.organizationId);
  }

  try {
    await syncSalePaymentDenorm(org.organizationId, id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to sync payment status" };
  }

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: actor.userId,
    actorRole: actor.role,
    actorEmail: actor.email,
    action: "sale.void",
    entityType: "sale",
    entityId: id,
    metadata: {
      summary: `Voided invoice ${invoice?.invoice_number ?? id.slice(0, 8)}`,
      reason: voidReason,
      total: sale.total,
      invoice_number: invoice?.invoice_number ?? null,
      before: { status: sale.status, total: sale.total },
    },
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
    .is("deleted_at", null)
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
    .is("deleted_at", null)
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
