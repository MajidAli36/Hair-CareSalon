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

export async function setStaffActive(
  staffId: string,
  isActive: boolean
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { error } = await supabase
    .from("staff")
    .update(
      isActive
        ? { is_active: true }
        : { is_active: false, online_booking_enabled: false }
    )
    .eq("id", staffId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/attendance");
  revalidatePath("/pos");
  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  return { success: true };
}

export async function deleteStaff(staffId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, full_name, email, phone, job_title")
    .eq("id", staffId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staff) return { error: "Staff not found" };

  await supabase
    .from("staff_attendance")
    .update({ check_out_at: new Date().toISOString() })
    .eq("staff_id", staffId)
    .eq("organization_id", org.organizationId)
    .is("check_out_at", null);

  const { resolveSoftDeleteActor, softDeleteEntity } = await import("@/lib/db/soft-delete");
  const actor = await resolveSoftDeleteActor();
  const result = await softDeleteEntity({
    table: "staff",
    id: staffId,
    organizationId: org.organizationId,
    actor,
    action: "staff.delete",
    entityType: "staff",
    summary: `Deleted staff ${staff.full_name}`,
    before: staff as unknown as Record<string, unknown>,
    extraPatch: { is_active: false, online_booking_enabled: false },
  });

  if (result.error) return { error: result.error };

  revalidatePath("/staff");
  revalidatePath("/attendance");
  revalidatePath("/pos");
  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  revalidatePath("/finances");
  return { success: true };
}

const MANUAL_BACKDATE_MAX_DAYS = 7;
const MANUAL_FUTURE_SLACK_MS = 5 * 60 * 1000;

function parseManualAt(value: string | null | undefined, label: string): Date | { error: string } {
  if (!value?.trim()) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { error: `Invalid ${label}` };
  const now = Date.now();
  if (parsed.getTime() > now + MANUAL_FUTURE_SLACK_MS) {
    return { error: `${label} cannot be in the future` };
  }
  const oldest = now - MANUAL_BACKDATE_MAX_DAYS * 24 * 60 * 60 * 1000;
  if (parsed.getTime() < oldest) {
    return { error: `${label} cannot be more than ${MANUAL_BACKDATE_MAX_DAYS} days ago` };
  }
  return parsed;
}

export type ManualAttendanceOptions = {
  /** Actual check-in or check-out time (ISO / datetime-local). Defaults to now. */
  at?: string | null;
  /** For recording a completed past shift during outages */
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

export async function recordManualAttendance(
  staffId: string,
  action: "in" | "out" | "session",
  options: ManualAttendanceOptions = {}
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, full_name, is_active")
    .eq("organization_id", org.organizationId)
    .eq("id", staffId)
    .maybeSingle();

  if (!staff) return { error: "Staff not found" };
  if (!staff.is_active) return { error: "Staff is inactive" };

  const { data: open } = await supabase
    .from("staff_attendance")
    .select("id, check_in_at")
    .eq("staff_id", staffId)
    .eq("organization_id", org.organizationId)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (action === "session") {
    if (open) {
      return { error: `${staff.full_name} is already checked in — check out first` };
    }
    const checkIn = parseManualAt(options.checkInAt, "Check-in time");
    if ("error" in checkIn) return checkIn;
    const checkOut = parseManualAt(options.checkOutAt, "Check-out time");
    if ("error" in checkOut) return checkOut;
    if (checkOut.getTime() <= checkIn.getTime()) {
      return { error: "Check-out must be after check-in" };
    }
    const maxShiftMs = 18 * 60 * 60 * 1000;
    if (checkOut.getTime() - checkIn.getTime() > maxShiftMs) {
      return { error: "Shift cannot exceed 18 hours" };
    }

    const { error } = await supabase.from("staff_attendance").insert({
      organization_id: org.organizationId,
      staff_id: staffId,
      method: "MANUAL",
      check_in_at: checkIn.toISOString(),
      check_out_at: checkOut.toISOString(),
      notes: "Backdated manual shift (power/internet recovery)",
    });
    if (error) return { error: error.message };
  } else if (action === "in") {
    if (open) return { error: `${staff.full_name} is already checked in` };
    const at = parseManualAt(options.at, "Check-in time");
    if ("error" in at) return at;

    const { error } = await supabase.from("staff_attendance").insert({
      organization_id: org.organizationId,
      staff_id: staffId,
      method: "MANUAL",
      check_in_at: at.toISOString(),
      notes: options.at?.trim()
        ? "Manual check-in with adjusted time"
        : null,
    });
    if (error) return { error: error.message };
  } else {
    if (!open) return { error: `${staff.full_name} has no open check-in` };
    const at = parseManualAt(options.at, "Check-out time");
    if ("error" in at) return at;
    const openIn = new Date(open.check_in_at).getTime();
    if (at.getTime() <= openIn) {
      return { error: "Check-out must be after the current check-in time" };
    }

    const { error } = await supabase
      .from("staff_attendance")
      .update(
        options.at?.trim()
          ? {
              check_out_at: at.toISOString(),
              notes: "Manual check-out with adjusted time",
            }
          : { check_out_at: at.toISOString() }
      )
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
    .is("deleted_at", null)
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
