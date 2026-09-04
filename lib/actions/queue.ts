"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { queueDeviceCommand, findDeviceByType } from "@/lib/devices/helpers";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/dates/local";
import { formatCustomerName } from "@/lib/format";
import type { ActionResult } from "@/types/commerce";

const issueSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  token_date: z.string().min(1),
  staff_id: z.string().uuid().optional().or(z.literal("")),
  chair_id: z.string().uuid().optional().or(z.literal("")),
  token_time: z.string().optional().or(z.literal("")),
});

function resolveIssuedAt(tokenDate: string, tokenTime?: string): string {
  if (tokenTime && /^\d{2}:\d{2}$/.test(tokenTime)) {
    return new Date(`${tokenDate}T${tokenTime}:00`).toISOString();
  }
  return new Date().toISOString();
}

export async function issueWalkInToken(
  prev: ActionResult | FormData,
  formData?: FormData
): Promise<
  ActionResult & {
    tokenNumber?: number;
    customerName?: string;
    customerPhone?: string | null;
    staffName?: string | null;
    chair?: string | null;
    issuedAt?: string;
    queueDate?: string;
  }
> {
  const data = prev instanceof FormData ? prev : formData;
  if (!data) return { error: "Invalid form data" };

  const org = await requireMinimumRole("RECEPTIONIST");
  const parsed = issueSchema.safeParse({
    customer_id: data.get("customer_id"),
    token_date: data.get("token_date") || getLocalDateString(),
    staff_id: data.get("staff_id") || "",
    chair_id: data.get("chair_id") || "",
    token_time: data.get("token_time") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { customer_id, token_date, staff_id, chair_id, token_time } = parsed.data;
  const today = getLocalDateString();
  if (token_date !== today) {
    return { error: "Tokens can only be issued for today. Change date to view history." };
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, email")
    .eq("id", customer_id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!customer) return { error: "Customer not found" };

  const resolvedStaffId: string | null = staff_id || null;
  let staffName: string | null = null;

  if (resolvedStaffId) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("id", resolvedStaffId)
      .eq("organization_id", org.organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff) return { error: "Selected staff not found" };
    staffName = staff.full_name;
  }

  const resolvedChairId: string | null = chair_id || null;
  let chairName: string | null = null;

  if (resolvedChairId) {
    const { data: chair } = await supabase
      .from("chairs")
      .select("id, name")
      .eq("id", resolvedChairId)
      .eq("organization_id", org.organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (!chair) return { error: "Selected chair not found" };
    chairName = chair.name;
  }

  const issuedAt = resolveIssuedAt(token_date, token_time || undefined);
  const customerName = formatCustomerName(customer.first_name, customer.last_name);

  const { data: tokenNum } = await supabase.rpc("next_queue_token_number", {
    org_id: org.organizationId,
  });

  const tokenNumber = tokenNum ?? 1;

  const { data: token, error } = await supabase
    .from("queue_tokens")
    .insert({
      organization_id: org.organizationId,
      token_number: tokenNumber,
      token_date,
      customer_id: customer.id,
      customer_name: customerName,
      staff_id: resolvedStaffId,
      chair_id: resolvedChairId,
      chair: chairName,
      issued_at: issuedAt,
    })
    .select("token_number, issued_at")
    .single();

  if (error) return { error: error.message };

  const printerId = await findDeviceByType(org.organizationId, "PRINTER");
  const kioskId = await findDeviceByType(org.organizationId, "TOKEN_KIOSK");
  const target = kioskId ?? printerId;
  if (target) {
    await queueDeviceCommand(org.organizationId, target, "PRINT_TOKEN", {
      tokenNumber: token?.token_number ?? tokenNumber,
      customerName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      staffName,
      chair: chairName,
      issuedAt: token?.issued_at ?? issuedAt,
    });
  }

  revalidatePath("/queue");
  return {
    success: true,
    tokenNumber: token?.token_number ?? tokenNumber,
    customerName,
    customerPhone: customer.phone,
    staffName,
    chair: chairName,
    issuedAt: token?.issued_at ?? issuedAt,
    queueDate: token_date,
  };
}

export async function updateTokenStatus(
  tokenId: string,
  status: "CALLED" | "SERVING" | "COMPLETED" | "CANCELLED"
): Promise<ActionResult> {
  const org = await requireMinimumRole("RECEPTIONIST");
  const supabase = await createClient();

  const updates: Record<string, string> = { status };
  if (status === "CALLED") updates.called_at = new Date().toISOString();
  if (status === "COMPLETED") updates.completed_at = new Date().toISOString();

  const { data: token } = await supabase
    .from("queue_tokens")
    .select("appointment_id")
    .eq("id", tokenId)
    .eq("organization_id", org.organizationId)
    .single();

  const { error } = await supabase
    .from("queue_tokens")
    .update(updates)
    .eq("id", tokenId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  if (status === "COMPLETED" && token?.appointment_id) {
    await supabase
      .from("appointments")
      .update({ status: "COMPLETED" })
      .eq("id", token.appointment_id)
      .eq("organization_id", org.organizationId);
  }

  revalidatePath("/queue");
  revalidatePath("/appointments");
  return { success: true };
}

export type QueueTokenRow = {
  id: string;
  token_number: number;
  token_date: string;
  customer_id: string | null;
  customer_name: string;
  staff_id: string | null;
  chair_id: string | null;
  chair: string | null;
  issued_at: string;
  created_at: string;
  status: string;
  customer: { phone: string | null; email: string | null } | null;
  staff: { id: string; full_name: string } | null;
};

export async function getQueueByDate(date?: string, filters?: { staffId?: string; chairId?: string }) {
  const org = await requireOrganization();
  const supabase = await createClient();
  const tokenDate = date ?? getLocalDateString();

  let query = supabase
    .from("queue_tokens")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("token_date", tokenDate)
    .order("token_number");

  if (filters?.staffId) query = query.eq("staff_id", filters.staffId);
  if (filters?.chairId) query = query.eq("chair_id", filters.chairId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const staffIds = [
    ...new Set(rows.map((r) => (r as { staff_id?: string | null }).staff_id).filter(Boolean)),
  ] as string[];

  const customerMap: Record<string, { phone: string | null; email: string | null }> = {};
  const staffMap: Record<string, { id: string; full_name: string }> = {};

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, phone, email")
      .in("id", customerIds);
    for (const c of customers ?? []) {
      customerMap[c.id] = { phone: c.phone, email: c.email };
    }
  }

  if (staffIds.length > 0) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id, full_name")
      .in("id", staffIds);
    for (const s of staff ?? []) {
      staffMap[s.id] = { id: s.id, full_name: s.full_name };
    }
  }

  return rows.map((row) => {
    const staffId = (row as { staff_id?: string | null }).staff_id ?? null;
    const chairId = (row as { chair_id?: string | null }).chair_id ?? null;
    const chair = (row as { chair?: string | null }).chair ?? null;
    const issuedAt = (row as { issued_at?: string }).issued_at ?? row.created_at;

    return {
      id: row.id,
      token_number: row.token_number,
      token_date: row.token_date,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      staff_id: staffId,
      chair_id: chairId,
      chair,
      issued_at: issuedAt,
      created_at: row.created_at,
      status: row.status,
      customer: row.customer_id ? customerMap[row.customer_id] ?? null : null,
      staff: staffId ? staffMap[staffId] ?? null : null,
    } satisfies QueueTokenRow;
  });
}

export async function getTodayQueue() {
  return getQueueByDate();
}

export async function openDrawer(source = "manual"): Promise<ActionResult> {
  const org = await requireMinimumRole("CASHIER");
  const drawerId = await findDeviceByType(org.organizationId, "DRAWER");
  if (!drawerId) {
    return { error: "No cash drawer device registered. Add one under Devices." };
  }
  await queueDeviceCommand(org.organizationId, drawerId, "OPEN_DRAWER", { source });
  return { success: true };
}

export async function printSaleReceipt(saleId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("CASHIER");
  const printerId = await findDeviceByType(org.organizationId, "PRINTER");
  if (!printerId) return { error: "No printer device registered" };
  await queueDeviceCommand(org.organizationId, printerId, "PRINT_RECEIPT", { saleId });
  return { success: true };
}
