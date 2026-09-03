"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";

const staffSchema = z.object({
  full_name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  job_title: z.string().optional(),
  pin_code: z.string().optional(),
});

export async function createStaff(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = staffSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    job_title: formData.get("job_title") || undefined,
    pin_code: formData.get("pin_code") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase.from("staff").insert({
    organization_id: org.organizationId,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email || null,
    job_title: parsed.data.job_title ?? null,
    pin_code: parsed.data.pin_code ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/attendance");
  return { success: true };
}

export async function recordManualAttendance(staffId: string, action: "in" | "out"): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  if (action === "in") {
    const { error } = await supabase.from("staff_attendance").insert({
      organization_id: org.organizationId,
      staff_id: staffId,
      method: "MANUAL",
    });
    if (error) return { error: error.message };
  } else {
    const { data: open } = await supabase
      .from("staff_attendance")
      .select("id")
      .eq("staff_id", staffId)
      .eq("organization_id", org.organizationId)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false })
      .limit(1)
      .single();
    if (!open) return { error: "No open check-in found" };
    const { error } = await supabase
      .from("staff_attendance")
      .update({ check_out_at: new Date().toISOString() })
      .eq("id", open.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/staff");
  revalidatePath("/attendance");
  return { success: true };
}

export async function getStaff() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("organization_id", org.organizationId)
    .order("full_name");
  if (error) throw new Error(error.message);
  return data;
}

export async function getStaffAttendance(limit = 30) {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_attendance")
    .select("*, staff:staff(id, full_name)")
    .eq("organization_id", org.organizationId)
    .order("check_in_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as unknown as {
    id: string;
    check_in_at: string;
    check_out_at: string | null;
    method: string;
    staff: { id: string; full_name: string } | null;
  }[];
}

export async function getStaffOnDuty() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_attendance")
    .select("staff_id")
    .eq("organization_id", org.organizationId)
    .is("check_out_at", null);
  return new Set((data ?? []).map((r) => r.staff_id));
}

const thumbSchema = z.object({
  staff_id: z.string().uuid(),
  thumb_id: z.string().min(1, "Thumb ID required").max(64),
});

export async function enrollStaffThumb(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = thumbSchema.safeParse({
    staff_id: formData.get("staff_id"),
    thumb_id: formData.get("thumb_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const thumbId = parsed.data.thumb_id.trim();

  const { data: existing } = await supabase
    .from("staff")
    .select("id, full_name")
    .eq("organization_id", org.organizationId)
    .eq("thumb_id", thumbId)
    .maybeSingle();

  if (existing && existing.id !== parsed.data.staff_id) {
    return { error: `This thumb is already enrolled for ${existing.full_name}` };
  }

  const { error } = await supabase
    .from("staff")
    .update({
      thumb_id: thumbId,
      thumb_enrolled_at: new Date().toISOString(),
    })
    .eq("organization_id", org.organizationId)
    .eq("id", parsed.data.staff_id);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/attendance");
  return { success: true };
}

export async function removeStaffThumb(staffId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ thumb_id: null, thumb_enrolled_at: null })
    .eq("organization_id", org.organizationId)
    .eq("id", staffId);
  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/attendance");
  return { success: true };
}
