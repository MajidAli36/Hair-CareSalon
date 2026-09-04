"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";
import type { Product, ProductCategory } from "@/types";
import {
  getInventorySummary,
  type InventorySummary,
} from "@/lib/inventory/valuation";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  category_id: z.string().optional(),
  cost_price: z.coerce.number().min(0),
  retail_price: z.coerce.number().min(0),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  is_active: z.coerce.boolean().default(true),
});

export async function createProductCategory(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Name is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").insert({
    organization_id: org.organizationId,
    name: name.trim(),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProductCategory(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { success: true };
}

export async function createProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const categoryId = formData.get("category_id") as string;
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    description: formData.get("description") || undefined,
    category_id: categoryId && categoryId !== "none" ? categoryId : undefined,
    cost_price: formData.get("cost_price"),
    retail_price: formData.get("retail_price"),
    stock_quantity: formData.get("stock_quantity") ?? 0,
    low_stock_threshold: formData.get("low_stock_threshold") ?? 5,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    organization_id: org.organizationId,
    category_id: parsed.data.category_id ?? null,
    sku: parsed.data.sku ?? null,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    cost_price: parsed.data.cost_price,
    retail_price: parsed.data.retail_price,
    stock_quantity: parsed.data.stock_quantity,
    low_stock_threshold: parsed.data.low_stock_threshold,
    is_active: parsed.data.is_active,
  });
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { success: true };
}

export async function adjustInventory(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const productId = formData.get("product_id") as string;
  const type = formData.get("type") as "IN" | "OUT" | "ADJUSTMENT";
  const quantity = Number(formData.get("quantity"));
  const notes = (formData.get("notes") as string) || null;

  if (!productId || !type || !quantity || quantity <= 0) {
    return { error: "Invalid inventory adjustment" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inventory_transactions").insert({
    organization_id: org.organizationId,
    product_id: productId,
    type,
    quantity,
    notes,
    created_by: user?.id ?? null,
    reference_type: "manual",
  });
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { success: true };
}

export async function getProductCategories() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("organization_id", org.organizationId)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return data as unknown as ProductCategory[];
}

export async function getProducts() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:product_categories(id, name)")
    .eq("organization_id", org.organizationId)
    .order("name");
  if (error) throw new Error(error.message);
  return data as unknown as (Product & { category: { id: string; name: string } | null })[];
}

export async function getInventoryTransactions(limit = 20) {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("*, product:products(id, name, sku, cost_price, retail_price)")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as unknown as {
    id: string;
    type: string;
    quantity: number;
    created_at: string;
    product: {
      id: string;
      name: string;
      sku: string | null;
      cost_price: number;
      retail_price: number;
    } | null;
  }[];
}

export async function getInventorySummaryStats(): Promise<InventorySummary> {
  const products = await getProducts();
  return getInventorySummary(products);
}

export async function getLowStockCount() {
  const products = await getLowStockProducts();
  return products.length;
}

export async function getLowStockProducts() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock_quantity, low_stock_threshold")
    .eq("organization_id", org.organizationId)
    .eq("is_active", true)
    .order("stock_quantity");
  if (error) return [];
  return data
    .filter((p) => p.stock_quantity <= p.low_stock_threshold)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock_quantity,
      threshold: p.low_stock_threshold,
    }));
}

export async function getPosCatalog() {
  const org = await requireOrganization();
  const supabase = await createClient();

  const [services, products, packages, customers, staff] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("organization_id", org.organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("products")
      .select("id, name, retail_price, stock_quantity")
      .eq("organization_id", org.organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("packages")
      .select("id, name, price")
      .eq("organization_id", org.organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("customers")
      .select("id, first_name, last_name, phone")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("first_name")
      .limit(100),
    supabase
      .from("staff")
      .select("id, full_name")
      .eq("organization_id", org.organizationId)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  return {
    services: services.data ?? [],
    products: products.data ?? [],
    packages: packages.data ?? [],
    customers: customers.data ?? [],
    staff: staff.data ?? [],
  };
}
