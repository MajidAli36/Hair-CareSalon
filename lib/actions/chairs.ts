"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";

const chairSchema = z.object({
  name: z.string().trim().min(1, "Chair name required").max(40),
});

export type ChairRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export async function getChairs(includeInactive = false): Promise<ChairRow[]> {
  const org = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("chairs")
    .select("id, name, sort_order, is_active, created_at")
    .eq("organization_id", org.organizationId)
    .order("sort_order")
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChairRow[];
}

function readFormData(
  prevOrData: ActionResult | FormData,
  formData?: FormData
): FormData | null {
  if (prevOrData instanceof FormData) return prevOrData;
  if (formData instanceof FormData) return formData;
  return null;
}

export async function createChair(
  prev: ActionResult | FormData,
  formData?: FormData
): Promise<ActionResult> {
  const data = readFormData(prev, formData);
  if (!data) return { error: "Invalid form data" };

  const org = await requireMinimumRole("MANAGER");
  const parsed = chairSchema.safeParse({ name: data.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("chairs")
    .select("sort_order")
    .eq("organization_id", org.organizationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("chairs").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    sort_order: (existing?.sort_order ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: "A chair with this name already exists" };
    return { error: error.message };
  }

  revalidatePath("/chairs");
  revalidatePath("/queue");
  return { success: true };
}

export async function renameChair(
  prev: ActionResult | FormData,
  formData?: FormData
): Promise<ActionResult> {
  const data = readFormData(prev, formData);
  if (!data) return { error: "Invalid form data" };

  const org = await requireMinimumRole("MANAGER");
  const id = String(data.get("id") ?? "");
  const parsed = chairSchema.safeParse({ name: data.get("name") });
  if (!id) return { error: "Chair id required" };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chairs")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) {
    if (error.code === "23505") return { error: "A chair with this name already exists" };
    return { error: error.message };
  }

  revalidatePath("/chairs");
  revalidatePath("/queue");
  return { success: true };
}

export async function setChairActive(id: string, isActive: boolean): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("chairs")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/chairs");
  revalidatePath("/queue");
  return { success: true };
}

export async function deleteChair(id: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("chairs")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/chairs");
  revalidatePath("/queue");
  return { success: true };
}
