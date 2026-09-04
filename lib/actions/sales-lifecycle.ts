"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/log";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";
import {
  calculateInvoiceTotals,
  calculateInventoryDelta,
  calculatePaymentAdjustment,
  type AmendPayload,
  roundMoney,
} from "@/lib/sales/calculate";
import { isPostedSaleStatus } from "@/lib/sales/lifecycle";
import { syncSalePaymentDenorm } from "@/lib/sales/sync-payment-denorm";

function revalidateSalePaths(saleId: string) {
  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath(`/sales/${saleId}/edit`);
  revalidatePath("/reports");
  revalidatePath("/finances");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
}

async function sumPayments(saleId: string, organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("sale_id", saleId)
    .eq("organization_id", organizationId);
  return (data ?? []).reduce((s, p) => s + Number(p.amount), 0);
}

async function sumRefunds(saleId: string, organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sale_refunds")
    .select("amount")
    .eq("sale_id", saleId)
    .eq("organization_id", organizationId);
  return (data ?? []).reduce((s, p) => s + Number(p.amount), 0);
}

async function ensureVersionOne(
  organizationId: string,
  sale: {
    id: string;
    customer_id: string | null;
    appointment_id: string | null;
    subtotal: number;
    discount: number;
    tax: number;
    deposit_applied: number;
    total: number;
    status: string;
    notes: string | null;
    current_version: number;
  },
  items: {
    item_type: string;
    item_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[],
  paymentTotal: number,
  userId: string | null
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("sale_versions")
    .select("id")
    .eq("sale_id", sale.id)
    .eq("version_number", 1)
    .maybeSingle();

  if (existing) return;

  const { data: version, error } = await supabase
    .from("sale_versions")
    .insert({
      organization_id: organizationId,
      sale_id: sale.id,
      version_number: 1,
      customer_id: sale.customer_id,
      appointment_id: sale.appointment_id,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      deposit_applied: sale.deposit_applied,
      total: sale.total,
      payment_total: paymentTotal,
      status: sale.status,
      notes: sale.notes,
      change_reason: "Original completed invoice",
      changed_by: userId,
    })
    .select("id")
    .single();

  if (error || !version) throw new Error(error?.message ?? "Failed to snapshot version 1");

  if (items.length) {
    const { error: itemsError } = await supabase.from("sale_version_items").insert(
      items.map((item) => ({
        organization_id: organizationId,
        sale_version_id: version.id,
        item_type: item.item_type as "SERVICE" | "PRODUCT" | "PACKAGE",
        item_id: item.item_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }))
    );
    if (itemsError) throw new Error(itemsError.message);
  }
}

async function applyInventoryDeltas(
  organizationId: string,
  saleId: string,
  deltas: { productId: string; delta: number }[],
  userId: string | null
) {
  const supabase = await createClient();
  for (const { productId, delta } of deltas) {
    if (delta === 0) continue;
    // delta > 0 → more stock out; delta < 0 → restore stock (IN)
    const type = delta > 0 ? "OUT" : "IN";
    const quantity = Math.abs(delta);
    const { error } = await supabase.from("inventory_transactions").insert({
      organization_id: organizationId,
      product_id: productId,
      type,
      quantity,
      reference_type: type === "OUT" ? "sale_amend" : "sale_amend_reverse",
      reference_id: saleId,
      notes: type === "OUT" ? "Amendment stock out" : "Amendment stock restore",
      created_by: userId,
    });
    if (error) throw new Error(`Inventory update failed: ${error.message}`);
  }
}

async function reverseAllProductStock(
  organizationId: string,
  saleId: string,
  items: { item_type: string; item_id: string; quantity: number }[],
  userId: string | null,
  referenceType: string
) {
  const supabase = await createClient();
  for (const item of items.filter((i) => i.item_type === "PRODUCT")) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    const { error } = await supabase.from("inventory_transactions").insert({
      organization_id: organizationId,
      product_id: item.item_id,
      type: "IN",
      quantity: qty,
      reference_type: referenceType,
      reference_id: saleId,
      notes: "Stock restored",
      created_by: userId,
    });
    if (error) throw new Error(`Inventory restore failed: ${error.message}`);
  }
}

/** Preview amendment financial impact (server-validated totals). */
export async function previewSaleAmendment(payload: AmendPayload) {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", payload.saleId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!sale) return { error: "Sale not found" };
  if (!isPostedSaleStatus(sale.status)) {
    return { error: "Only completed invoices can be amended" };
  }

  const totals = calculateInvoiceTotals(payload.items, payload.discount, payload.tax ?? 0);
  const paymentsTotal = await sumPayments(sale.id, org.organizationId);
  const refundsTotal = await sumRefunds(sale.id, org.organizationId);
  const adjustment = calculatePaymentAdjustment({
    oldTotal: Number(sale.total),
    newTotal: totals.total,
    paymentsTotal,
    refundsTotal,
  });

  return {
    totals,
    adjustment,
    currentVersion: Number(sale.current_version ?? 1),
  };
}

export async function amendCompletedSale(
  payload: AmendPayload
): Promise<ActionResult & { saleId?: string; version?: number }> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const reason = payload.changeReason?.trim() ?? "";
  if (reason.length < 3) return { error: "Change reason is required (min 3 characters)" };
  if (!payload.items?.length) return { error: "Invoice must have at least one line item" };

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("*")
    .eq("id", payload.saleId)
    .eq("organization_id", org.organizationId)
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Sale not found" };
  if (!isPostedSaleStatus(sale.status)) {
    return { error: "Only completed / amended invoices can be edited" };
  }

  const currentVersion = Number(sale.current_version ?? 1);
  if (payload.expectedVersion !== currentVersion) {
    return {
      error:
        "This invoice was changed by someone else. Reload and try again (concurrency protection).",
    };
  }

  const { data: oldItems, error: itemsErr } = await supabase
    .from("sale_items")
    .select("item_type, item_id, name, quantity, unit_price, line_total")
    .eq("sale_id", sale.id)
    .eq("organization_id", org.organizationId);

  if (itemsErr) return { error: itemsErr.message };

  const totals = calculateInvoiceTotals(payload.items, payload.discount, payload.tax ?? 0);
  const paymentsTotal = await sumPayments(sale.id, org.organizationId);
  const refundsTotal = await sumRefunds(sale.id, org.organizationId);
  const adjustment = calculatePaymentAdjustment({
    oldTotal: Number(sale.total),
    newTotal: totals.total,
    paymentsTotal,
    refundsTotal,
  });

  if (adjustment.additionalDue > 0 && payload.settleAdditionalNow) {
    const pay = payload.additionalPayment;
    if (!pay || Math.abs(Number(pay.amount) - adjustment.additionalDue) > 0.009) {
      return {
        error: `Additional payment of ${adjustment.additionalDue} is required when settling now.`,
      };
    }
  }
  if (adjustment.additionalDue > 0 && payload.additionalPayment) {
    const payAmt = roundMoney(payload.additionalPayment.amount);
    if (payAmt > adjustment.additionalDue + 0.009 || payAmt <= 0) {
      return { error: "Additional payment must be between 0 and the new outstanding amount" };
    }
  }
  if (adjustment.refundDue > 0) {
    const ref = payload.refundPayment;
    if (!ref || Math.abs(Number(ref.amount) - adjustment.refundDue) > 0.009) {
      return {
        error: `Refund of ${adjustment.refundDue} must be confirmed (paid exceeds new total).`,
      };
    }
  }

  const deltas = calculateInventoryDelta(
    (oldItems ?? []).map((item) => ({
      itemType: item.item_type,
      itemId: item.item_id,
      quantity: Number(item.quantity),
    })),
    totals.lines
  );
  let inventoryApplied = false;

  try {
    await ensureVersionOne(
      org.organizationId,
      {
        id: sale.id,
        customer_id: sale.customer_id,
        appointment_id: sale.appointment_id,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax ?? 0),
        deposit_applied: Number(sale.deposit_applied ?? 0),
        total: Number(sale.total),
        status: sale.status,
        notes: sale.notes,
        current_version: currentVersion,
      },
      oldItems ?? [],
      paymentsTotal,
      userId
    );

    await applyInventoryDeltas(org.organizationId, sale.id, deltas, userId);
    inventoryApplied = true;

    // Replace line items
    const { error: delErr } = await supabase
      .from("sale_items")
      .delete()
      .eq("sale_id", sale.id)
      .eq("organization_id", org.organizationId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabase.from("sale_items").insert(
      totals.lines.map((line) => ({
        organization_id: org.organizationId,
        sale_id: sale.id,
        item_type: line.itemType,
        item_id: line.itemId,
        name: line.name,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        line_total: line.lineTotal,
      }))
    );
    if (insErr) throw new Error(insErr.message);

    if (adjustment.additionalDue > 0 && payload.additionalPayment) {
      const payAmt = roundMoney(payload.additionalPayment.amount);
      if (payAmt > 0) {
        const { error: payErr } = await supabase.from("payments").insert({
          organization_id: org.organizationId,
          sale_id: sale.id,
          amount: payAmt,
          method: payload.additionalPayment.method,
          reference: "SALE_AMEND_ADDITIONAL",
          created_by: userId,
        });
        if (payErr) throw new Error(payErr.message);
      }
    }

    if (adjustment.refundDue > 0 && payload.refundPayment) {
      const { error: refundErr } = await supabase.from("sale_refunds").insert({
        organization_id: org.organizationId,
        sale_id: sale.id,
        amount: adjustment.refundDue,
        method: payload.refundPayment.method,
        reason: reason,
        reference: "SALE_AMEND_REFUND",
        created_by: userId,
      });
      if (refundErr) throw new Error(refundErr.message);

      await supabase.from("expenses").insert({
        organization_id: org.organizationId,
        category: "OTHER",
        amount: adjustment.refundDue,
        description: `Invoice amendment refund — ${reason}`,
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: payload.refundPayment.method,
        created_by: userId,
      });
    }

    const newVersion = currentVersion + 1;
    const newPaymentTotal =
      paymentsTotal +
      (adjustment.additionalDue > 0 ? adjustment.additionalDue : 0);

    const { data: version, error: verErr } = await supabase
      .from("sale_versions")
      .insert({
        organization_id: org.organizationId,
        sale_id: sale.id,
        version_number: newVersion,
        customer_id: payload.customerId ?? null,
        appointment_id: payload.appointmentId ?? sale.appointment_id,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        deposit_applied: Number(sale.deposit_applied ?? 0),
        total: totals.total,
        payment_total: newPaymentTotal,
        status: "AMENDED",
        notes: payload.notes ?? sale.notes,
        change_reason: reason,
        changed_by: userId,
      })
      .select("id")
      .single();

    if (verErr || !version) throw new Error(verErr?.message ?? "Failed to create version");

    const { error: vItemsErr } = await supabase.from("sale_version_items").insert(
      totals.lines.map((line) => ({
        organization_id: org.organizationId,
        sale_version_id: version.id,
        item_type: line.itemType,
        item_id: line.itemId,
        name: line.name,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        line_total: line.lineTotal,
      }))
    );
    if (vItemsErr) throw new Error(vItemsErr.message);

    const { error: updErr } = await supabase
      .from("sales")
      .update({
        customer_id: payload.customerId ?? null,
        appointment_id: payload.appointmentId ?? sale.appointment_id,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        notes: payload.notes ?? sale.notes,
        status: "AMENDED",
        current_version: newVersion,
        last_amended_at: new Date().toISOString(),
        last_amended_by: userId,
      })
      .eq("id", sale.id)
      .eq("organization_id", org.organizationId)
      .eq("current_version", currentVersion);

    if (updErr) throw new Error(updErr.message);

    await syncSalePaymentDenorm(org.organizationId, sale.id);

    await writeAuditLog({
      organizationId: org.organizationId,
      userId,
      action: "sale.amend",
      entityType: "sale",
      entityId: sale.id,
      metadata: {
        fromVersion: currentVersion,
        toVersion: newVersion,
        oldTotal: Number(sale.total),
        newTotal: totals.total,
        reason,
        inventoryDeltas: deltas,
        paymentAdjustment: adjustment,
      },
    });

    revalidateSalePaths(sale.id);
    return { success: true, saleId: sale.id, version: newVersion };
  } catch (e) {
    // Best-effort compensation when inventory already moved (no multi-statement DB txn via client)
    if (inventoryApplied && deltas.length) {
      try {
        await applyInventoryDeltas(
          org.organizationId,
          sale.id,
          deltas.map((d) => ({ productId: d.productId, delta: -d.delta })),
          userId
        );
      } catch {
        /* surfaced via original error */
      }
    }
    return { error: e instanceof Error ? e.message : "Amendment failed" };
  }
}

export async function refundSale(input: {
  saleId: string;
  amount: number;
  method: "CASH" | "CARD" | "OTHER";
  reason: string;
}): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const reason = input.reason?.trim() ?? "";
  if (reason.length < 3) return { error: "Refund reason is required" };
  const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
  if (amount <= 0) return { error: "Refund amount must be greater than zero" };

  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", input.saleId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!sale) return { error: "Sale not found" };
  if (!isPostedSaleStatus(sale.status) && sale.status !== "REFUNDED") {
    return { error: "Cannot refund this sale status" };
  }

  const paymentsTotal = await sumPayments(sale.id, org.organizationId);
  const refundsTotal = await sumRefunds(sale.id, org.organizationId);
  const refundable = Math.round((paymentsTotal - refundsTotal) * 100) / 100;
  if (amount > refundable + 0.009) {
    return { error: `Refund exceeds net collected (max ${refundable})` };
  }

  const { error: refundErr } = await supabase.from("sale_refunds").insert({
    organization_id: org.organizationId,
    sale_id: sale.id,
    amount,
    method: input.method,
    reason,
    created_by: user?.id ?? null,
  });
  if (refundErr) return { error: refundErr.message };

  await supabase.from("expenses").insert({
    organization_id: org.organizationId,
    category: "OTHER",
    amount,
    description: `Sale refund — ${reason}`,
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: input.method,
    created_by: user?.id ?? null,
  });

  const newRefunds = refundsTotal + amount;
  const fullyRefunded = newRefunds >= paymentsTotal - 0.009;

  if (fullyRefunded) {
    // Restore inventory on full refund
    const { data: items } = await supabase
      .from("sale_items")
      .select("item_type, item_id, quantity")
      .eq("sale_id", sale.id);
    try {
      await reverseAllProductStock(
        org.organizationId,
        sale.id,
        items ?? [],
        user?.id ?? null,
        "sale_refund_full"
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Inventory restore failed" };
    }

    await supabase
      .from("sales")
      .update({ status: "REFUNDED" })
      .eq("id", sale.id)
      .eq("organization_id", org.organizationId);
  }

  try {
    await syncSalePaymentDenorm(org.organizationId, sale.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to sync payment status" };
  }

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "sale.refund",
    entityType: "sale",
    entityId: sale.id,
    metadata: { amount, method: input.method, reason, fullyRefunded },
  });

  revalidateSalePaths(sale.id);
  return { success: true };
}

export async function getSaleVersions(saleId: string) {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_versions")
    .select("*, items:sale_version_items(*)")
    .eq("sale_id", saleId)
    .eq("organization_id", org.organizationId)
    .order("version_number", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSaleRefunds(saleId: string) {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sale_refunds")
    .select("*")
    .eq("sale_id", saleId)
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
