import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendanceMethod = "MANUAL" | "DEVICE" | "APP" | "BIOMETRIC";
export type AttendanceAction = "check_in" | "check_out" | "toggle";

type AdminClient = SupabaseClient;

export async function resolveStaffForAttendance(
  admin: AdminClient,
  organizationId: string,
  credentials: { staffId?: string; pinCode?: string; thumbId?: string }
): Promise<
  | { staffId: string; staffName: string; method: AttendanceMethod }
  | { error: string; status: number }
> {
  const { staffId, pinCode, thumbId } = credentials;

  if (staffId) {
    const { data: staff } = await admin
      .from("staff")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .eq("id", staffId)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff) return { error: "Staff not found", status: 404 };
    return { staffId: staff.id, staffName: staff.full_name, method: "DEVICE" };
  }

  if (thumbId) {
    const { data: staff } = await admin
      .from("staff")
      .select("id, full_name, thumb_id")
      .eq("organization_id", organizationId)
      .eq("thumb_id", thumbId)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff) return { error: "Thumb not enrolled", status: 404 };
    return { staffId: staff.id, staffName: staff.full_name, method: "BIOMETRIC" };
  }

  if (pinCode) {
    const { data: staff } = await admin
      .from("staff")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .eq("pin_code", pinCode)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff) return { error: "Invalid PIN", status: 404 };
    return { staffId: staff.id, staffName: staff.full_name, method: "DEVICE" };
  }

  return { error: "staffId, thumbId, or pinCode required", status: 400 };
}

export async function getOpenAttendanceSession(
  admin: AdminClient,
  organizationId: string,
  staffId: string
) {
  const { data } = await admin
    .from("staff_attendance")
    .select("id, check_in_at")
    .eq("staff_id", staffId)
    .eq("organization_id", organizationId)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function recordAttendanceAction(
  admin: AdminClient,
  input: {
    organizationId: string;
    staffId: string;
    staffName: string;
    method: AttendanceMethod;
    deviceId?: string | null;
    action: AttendanceAction;
  }
): Promise<
  | {
      ok: true;
      action: "check_in" | "check_out";
      staffId: string;
      staffName: string;
      method: AttendanceMethod;
      at: string;
    }
  | { error: string; status: number }
> {
  const open = await getOpenAttendanceSession(admin, input.organizationId, input.staffId);
  let resolvedAction = input.action;

  if (resolvedAction === "toggle") {
    resolvedAction = open ? "check_out" : "check_in";
  }

  if (resolvedAction === "check_in") {
    if (open) {
      return { error: "Already checked in", status: 409 };
    }
    const at = new Date().toISOString();
    const { error } = await admin.from("staff_attendance").insert({
      organization_id: input.organizationId,
      staff_id: input.staffId,
      device_id: input.deviceId ?? null,
      method: input.method,
      check_in_at: at,
    });
    if (error) return { error: error.message, status: 500 };
    return {
      ok: true,
      action: "check_in",
      staffId: input.staffId,
      staffName: input.staffName,
      method: input.method,
      at,
    };
  }

  if (!open) {
    return { error: "No open check-in", status: 400 };
  }

  const at = new Date().toISOString();
  const { error } = await admin
    .from("staff_attendance")
    .update({ check_out_at: at })
    .eq("id", open.id);
  if (error) return { error: error.message, status: 500 };

  return {
    ok: true,
    action: "check_out",
    staffId: input.staffId,
    staffName: input.staffName,
    method: input.method,
    at,
  };
}
