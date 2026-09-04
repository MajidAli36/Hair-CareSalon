"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";

export type { ActionResult };

const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export async function createCustomer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = customerSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    notes: formData.get("notes") || undefined,
    tags: formData.get("tags") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tags = parsed.data.tags
    ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: org.organizationId,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email || null,
      notes: parsed.data.notes ?? null,
      tags,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(
  id: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = customerSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    notes: formData.get("notes") || undefined,
    tags: formData.get("tags") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tags = parsed.data.tags
    ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email || null,
      notes: parsed.data.notes ?? null,
      tags,
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "customer.delete",
    entityType: "customer",
    entityId: id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function getCustomers(search?: string) {
  const org = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("first_name");

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getCustomer(id: string) {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (error) return null;
  return data;
}

export type CustomerHistory = {
  appointments: {
    id: string;
    scheduled_at: string;
    status: string;
    staff: { full_name: string } | null;
    services: { service_name: string; price: number }[];
  }[];
  sales: {
    id: string;
    total: number;
    status: string;
    completed_at: string | null;
    amount_paid?: number;
    amount_due?: number;
    payment_status?: string;
    invoice: { invoice_number: string } | { invoice_number: string }[] | null;
    items: { name: string; quantity: number; line_total: number }[];
  }[];
  stats: {
    totalSpent: number;
    visitCount: number;
    appointmentCount: number;
  };
};

export async function getCustomerHistory(customerId: string): Promise<CustomerHistory | null> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const customer = await getCustomer(customerId);
  if (!customer) return null;

  const [appointments, sales] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        id, scheduled_at, status,
        staff:staff(full_name),
        services:appointment_services(service_name, price)
      `)
      .eq("organization_id", org.organizationId)
      .eq("customer_id", customerId)
      .order("scheduled_at", { ascending: false })
      .limit(50)
      .then(({ data }) => data ?? []),
    supabase
      .from("sales")
      .select(`
        id, total, status, completed_at, amount_paid, amount_due, payment_status,
        invoice:invoices(invoice_number),
        items:sale_items(name, quantity, line_total)
      `)
      .eq("organization_id", org.organizationId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => data ?? []),
  ]);

  const completedSales = sales.filter(
    (s) => s.status === "COMPLETED" || s.status === "AMENDED"
  );
  const totalSpent = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

  return {
    appointments: appointments as unknown as CustomerHistory["appointments"],
    sales: sales as unknown as CustomerHistory["sales"],
    stats: {
      totalSpent,
      visitCount: completedSales.length,
      appointmentCount: appointments.length,
    },
  };
}
