"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/customers";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  sort_order: z.coerce.number().int().min(0).default(0),
});

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  duration_minutes: z.coerce.number().int().min(1, "Duration must be at least 1 minute"),
  is_active: z.coerce.boolean().default(true),
});

const packageSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  is_active: z.coerce.boolean().default(true),
});

export async function createCategory(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    sort_order: parsed.data.sort_order,
  });

  if (error) return { error: error.message };
  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("service_categories")
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return { error: "Category not found" };

  const { resolveSoftDeleteActor, softDeleteEntity } = await import("@/lib/db/soft-delete");
  const actor = await resolveSoftDeleteActor();
  const result = await softDeleteEntity({
    table: "service_categories",
    id,
    organizationId: org.organizationId,
    actor,
    action: "service_category.delete",
    entityType: "service_category",
    summary: `Deleted service category ${row.name}`,
    before: row as unknown as Record<string, unknown>,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function createService(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const categoryId = formData.get("category_id") as string;

  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category_id: categoryId && categoryId !== "none" ? categoryId : undefined,
    price: formData.get("price"),
    duration_minutes: formData.get("duration_minutes"),
    is_active: formData.get("is_active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    organization_id: org.organizationId,
    category_id: parsed.data.category_id ?? null,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price: parsed.data.price,
    duration_minutes: parsed.data.duration_minutes,
    is_active: parsed.data.is_active,
  });

  if (error) return { error: error.message };
  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function updateService(
  id: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const categoryId = formData.get("category_id") as string;

  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category_id: categoryId && categoryId !== "none" ? categoryId : undefined,
    price: formData.get("price"),
    duration_minutes: formData.get("duration_minutes"),
    is_active: formData.get("is_active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "Service not found" };

  const { error } = await supabase
    .from("services")
    .update({
      category_id: parsed.data.category_id ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      duration_minutes: parsed.data.duration_minutes,
      is_active: parsed.data.is_active,
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (error) return { error: error.message };
  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("services")
    .select("id, name, price")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return { error: "Service not found" };

  const { resolveSoftDeleteActor, softDeleteEntity } = await import("@/lib/db/soft-delete");
  const actor = await resolveSoftDeleteActor();
  const result = await softDeleteEntity({
    table: "services",
    id,
    organizationId: org.organizationId,
    actor,
    action: "service.delete",
    entityType: "service",
    summary: `Deleted service ${row.name}`,
    before: row as unknown as Record<string, unknown>,
    extraPatch: { is_active: false },
  });
  if (result.error) return { error: result.error };
  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function createPackage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    is_active: formData.get("is_active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const serviceIds = formData.getAll("service_ids") as string[];
  const quantities = formData.getAll("quantities") as string[];

  const supabase = await createClient();
  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .insert({
      organization_id: org.organizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      is_active: parsed.data.is_active,
    })
    .select("id")
    .single();

  if (pkgError || !pkg) return { error: pkgError?.message ?? "Failed to create package" };

  const items = serviceIds
    .map((serviceId, i) => ({
      organization_id: org.organizationId,
      package_id: pkg.id,
      service_id: serviceId,
      quantity: parseInt(quantities[i] ?? "0", 10) || 0,
      sort_order: i,
    }))
    .filter((item) => item.quantity > 0);

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("package_items").insert(items);
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function deletePackage(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("packages")
    .select("id, name, price")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return { error: "Package not found" };

  const { resolveSoftDeleteActor, softDeleteEntity } = await import("@/lib/db/soft-delete");
  const actor = await resolveSoftDeleteActor();
  const result = await softDeleteEntity({
    table: "packages",
    id,
    organizationId: org.organizationId,
    actor,
    action: "package.delete",
    entityType: "package",
    summary: `Deleted package ${row.name}`,
    before: row as unknown as Record<string, unknown>,
    extraPatch: { is_active: false },
  });
  if (result.error) return { error: result.error };
  revalidatePath("/services");
  revalidatePath("/");
  revalidatePath("/book");
  return { success: true };
}

export async function getServiceCategories() {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getServices() {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*, category:service_categories(id, name)")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getPackages() {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packages")
    .select(`
      *,
      items:package_items (
        id,
        quantity,
        sort_order,
        service:services (id, name, price, duration_minutes)
      )
    `)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export type ServiceConsumableRow = {
  id: string;
  service_id: string;
  product_id: string;
  quantity: number;
  product: { id: string; name: string; stock_quantity: number; sku: string | null } | null;
};

export async function getServiceConsumables(
  serviceId: string
): Promise<ServiceConsumableRow[]> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_consumables")
    .select(
      `
      id, service_id, product_id, quantity,
      product:products(id, name, stock_quantity, sku)
    `
    )
    .eq("organization_id", org.organizationId)
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ServiceConsumableRow[];
}

/** Map service_id → number of linked salon products (for admin table badge). */
export async function getServiceConsumableCounts(): Promise<Record<string, number>> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_consumables")
    .select("service_id")
    .eq("organization_id", org.organizationId);

  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.service_id] = (counts[row.service_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Replace the full salon-stock recipe for a service.
 * Empty list clears all links (service no longer consumes stock).
 */
export async function saveServiceConsumables(
  serviceId: string,
  items: { productId: string; quantity: number }[]
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("id, name")
    .eq("id", serviceId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!service) return { error: "Service not found" };

  const cleaned: { productId: string; quantity: number }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const productId = item.productId?.trim();
    const quantity = Math.floor(Number(item.quantity) || 0);
    if (!productId || quantity <= 0) continue;
    if (seen.has(productId)) {
      return { error: "Each product can only be linked once per service" };
    }
    seen.add(productId);
    cleaned.push({ productId, quantity });
  }

  if (cleaned.length) {
    const productIds = cleaned.map((c) => c.productId);
    const { data: products } = await supabase
      .from("products")
      .select("id, usage_kind")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .in("id", productIds);
    if ((products ?? []).length !== productIds.length) {
      return { error: "One or more products were not found" };
    }
    const invalid = (products ?? []).find(
      (p) => p.usage_kind === "RETAIL"
    );
    if (invalid) {
      return {
        error:
          "Customer/retail products cannot be linked as salon stock. Edit the product type to In-house or Both.",
      };
    }
  }

  const { error: delErr } = await supabase
    .from("service_consumables")
    .delete()
    .eq("service_id", serviceId)
    .eq("organization_id", org.organizationId);
  if (delErr) return { error: delErr.message };

  if (cleaned.length) {
    const { error: insErr } = await supabase.from("service_consumables").insert(
      cleaned.map((c) => ({
        organization_id: org.organizationId,
        service_id: serviceId,
        product_id: c.productId,
        quantity: c.quantity,
      }))
    );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/services");
  revalidatePath("/products");
  revalidatePath("/pos");
  return { success: true };
}
