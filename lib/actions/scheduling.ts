"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  computeAvailableSlots,
  sumServiceDuration,
  type BookableSlot,
} from "@/lib/booking/availability";
import type { ActionResult } from "@/types/commerce";

export type StaffScheduleRow = {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const scheduleSchema = z.object({
  staff_id: z.string().uuid(),
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
});

async function fetchSlotData(organizationId: string, useAdmin = false, onlineOnly = false) {
  const admin = useAdmin ? tryCreateAdminClient() : null;
  const client = admin ?? (await createClient());

  let staffQuery = client
    .from("staff")
    .select("id, full_name, online_booking_enabled")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("full_name");

  if (onlineOnly) {
    staffQuery = staffQuery.eq("online_booking_enabled", true);
  }

  const [{ data: staff }, { data: schedules }, { data: appointments }, { data: org }] =
    await Promise.all([
      staffQuery,
      client.from("staff_schedules").select("*").eq("organization_id", organizationId),
      client
        .from("appointments")
        .select("id, staff_id, scheduled_at, duration_minutes, status")
        .eq("organization_id", organizationId),
      client
        .from("organizations")
        .select("booking_slot_minutes, booking_days_ahead")
        .eq("id", organizationId)
        .single(),
    ]);

  const activeAppointments = (appointments ?? []).filter(
    (a) => !["CANCELLED", "NO_SHOW"].includes(a.status)
  );

  return {
    staff: staff ?? [],
    schedules: schedules ?? [],
    appointments: activeAppointments,
    slotMinutes: org?.booking_slot_minutes ?? 30,
    daysAhead: org?.booking_days_ahead ?? 30,
  };
}

function slotsMatchRequested(slots: BookableSlot[], scheduledAt: string, staffId?: string | null) {
  const requested = new Date(scheduledAt).getTime();
  return slots.some((s) => {
    const diff = Math.abs(new Date(s.iso).getTime() - requested);
    return diff < 90_000 && (!staffId || s.staffId === staffId);
  });
}

export async function getAvailableSlots(params: {
  date: string;
  durationMinutes?: number;
  staffId?: string | null;
  serviceIds?: string[];
}): Promise<BookableSlot[]> {
  const org = await requireOrganization();
  const supabase = await createClient();

  let duration = params.durationMinutes ?? 30;
  if (params.serviceIds?.length) {
    const { data: services } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("organization_id", org.organizationId)
      .in("id", params.serviceIds);
    duration = sumServiceDuration(services ?? [], duration);
  }

  const data = await fetchSlotData(org.organizationId);
  return computeAvailableSlots({
    date: params.date,
    durationMinutes: duration,
    slotIntervalMinutes: data.slotMinutes,
    staff: data.staff,
    schedules: data.schedules,
    appointments: data.appointments,
    staffId: params.staffId,
    maxDaysAhead: data.daysAhead,
    onlineOnly: false,
  });
}

export async function getPublicAvailableSlots(
  orgSlug: string,
  date: string,
  staffId: string,
  serviceIds: string[]
): Promise<BookableSlot[]> {
  const admin = tryCreateAdminClient();
  if (!admin) return [];

  const { data: org } = await admin.from("organizations").select("id").eq("slug", orgSlug).single();
  if (!org) return [];

  let duration = 30;
  if (serviceIds.length) {
    const { data: services } = await admin
      .from("services")
      .select("duration_minutes")
      .eq("organization_id", org.id)
      .in("id", serviceIds);
    duration = sumServiceDuration(services ?? [], 30);
  }

  const data = await fetchSlotData(org.id, true, true);
  return computeAvailableSlots({
    date,
    durationMinutes: duration,
    slotIntervalMinutes: data.slotMinutes,
    staff: data.staff,
    schedules: data.schedules,
    appointments: data.appointments,
    staffId,
    maxDaysAhead: data.daysAhead,
    onlineOnly: true,
  });
}

export async function validateAppointmentSlot(params: {
  organizationId: string;
  scheduledAt: string;
  durationMinutes: number;
  staffId?: string | null;
  excludeAppointmentId?: string;
  useAdmin?: boolean;
  onlineOnly?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const date = params.scheduledAt.slice(0, 10);
  const data = await fetchSlotData(
    params.organizationId,
    params.useAdmin,
    params.onlineOnly ?? false
  );

  const slots = computeAvailableSlots({
    date,
    durationMinutes: params.durationMinutes,
    slotIntervalMinutes: data.slotMinutes,
    staff: data.staff,
    schedules: data.schedules,
    appointments: data.appointments,
    staffId: params.staffId,
    excludeAppointmentId: params.excludeAppointmentId,
    maxDaysAhead: data.daysAhead,
    onlineOnly: params.onlineOnly ?? false,
  });

  if (!slotsMatchRequested(slots, params.scheduledAt, params.staffId)) {
    return {
      ok: false,
      error: params.onlineOnly
        ? "This online slot is no longer available. Someone may have booked it — choose another time."
        : params.staffId
          ? "This staff member is not available at the selected time. Pick another slot."
          : "No staff available at the selected time. Pick another slot.",
    };
  }

  return { ok: true };
}

export async function saveStaffSchedule(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = scheduleSchema.safeParse({
    staff_id: formData.get("staff_id"),
    day_of_week: formData.get("day_of_week"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_schedules").upsert(
    {
      organization_id: org.organizationId,
      staff_id: parsed.data.staff_id,
      day_of_week: parsed.data.day_of_week,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
    },
    { onConflict: "staff_id,day_of_week" }
  );

  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  return { success: true };
}

export async function getOnlineBookingStaff() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, full_name, job_title, online_booking_enabled")
    .eq("organization_id", org.organizationId)
    .eq("is_active", true)
    .order("full_name");
  return data ?? [];
}

export async function setStaffOnlineBooking(
  staffId: string,
  enabled: boolean
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ online_booking_enabled: enabled })
    .eq("id", staffId)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/online-booking");
  revalidatePath("/book");
  revalidatePath("/");
  return { success: true };
}

export async function getStaffSchedulesForOrg() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_schedules")
    .select("staff_id, day_of_week, start_time, end_time")
    .eq("organization_id", org.organizationId);
  return data ?? [];
}
