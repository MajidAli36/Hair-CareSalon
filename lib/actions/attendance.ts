"use server";

import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { recordManualAttendance } from "@/lib/actions/staff";
import { endOfLocalDay, getLocalDateString, startOfLocalDay } from "@/lib/dates/local";

export type AttendanceRecord = {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  method: string;
  staff: { id: string; full_name: string } | null;
  durationMinutes: number | null;
};

export type StaffAttendanceSummary = {
  staffId: string;
  staffName: string;
  sessions: number;
  workingDays: number;
  totalHours: number;
  avgHoursPerDay: number;
};

export type AttendanceReport = {
  records: AttendanceRecord[];
  summaries: StaffAttendanceSummary[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    openSessions: number;
    uniqueStaffDays: number;
  };
};

function parseDateRange(from?: string, to?: string) {
  const toLabel = to ?? getLocalDateString();
  const fromLabel = from ?? toLabel;
  return {
    start: startOfLocalDay(fromLabel),
    end: endOfLocalDay(toLabel),
  };
}

function sessionDurationMinutes(checkIn: string, checkOut: string | null) {
  if (!checkOut) return null;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export async function getAttendanceReport(
  from?: string,
  to?: string,
  staffId?: string
): Promise<AttendanceReport> {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { start, end } = parseDateRange(from, to);

  let query = supabase
    .from("staff_attendance")
    .select("*, staff:staff(id, full_name)")
    .eq("organization_id", org.organizationId)
    .gte("check_in_at", start.toISOString())
    .lte("check_in_at", end.toISOString())
    .order("check_in_at", { ascending: false });

  if (staffId) query = query.eq("staff_id", staffId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const raw = (data ?? []) as unknown as {
    id: string;
    staff_id: string;
    check_in_at: string;
    check_out_at: string | null;
    method: string;
    staff: { id: string; full_name: string } | null;
  }[];

  const records: AttendanceRecord[] = raw.map((r) => ({
    id: r.id,
    check_in_at: r.check_in_at,
    check_out_at: r.check_out_at,
    method: r.method,
    staff: r.staff,
    durationMinutes: sessionDurationMinutes(r.check_in_at, r.check_out_at),
  }));

  const byStaff = new Map<
    string,
    { name: string; sessions: number; days: Set<string>; totalMinutes: number }
  >();

  for (const r of raw) {
    const key = r.staff_id;
    if (!byStaff.has(key)) {
      byStaff.set(key, {
        name: r.staff?.full_name ?? "Unknown",
        sessions: 0,
        days: new Set(),
        totalMinutes: 0,
      });
    }
    const entry = byStaff.get(key)!;
    entry.sessions += 1;
    entry.days.add(r.check_in_at.slice(0, 10));
    const mins = sessionDurationMinutes(r.check_in_at, r.check_out_at);
    if (mins) entry.totalMinutes += mins;
  }

  const summaries: StaffAttendanceSummary[] = [...byStaff.entries()].map(([staffId, s]) => ({
    staffId,
    staffName: s.name,
    sessions: s.sessions,
    workingDays: s.days.size,
    totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
    avgHoursPerDay:
      s.days.size > 0 ? Math.round((s.totalMinutes / 60 / s.days.size) * 10) / 10 : 0,
  }));

  summaries.sort((a, b) => b.workingDays - a.workingDays);

  const completedSessions = records.filter((r) => r.check_out_at).length;
  const uniqueStaffDays = new Set(
    raw.map((r) => `${r.staff_id}:${r.check_in_at.slice(0, 10)}`)
  ).size;

  return {
    records,
    summaries,
    stats: {
      totalSessions: records.length,
      completedSessions,
      openSessions: records.length - completedSessions,
      uniqueStaffDays,
    },
  };
}

export type AttendanceOverview = {
  enrolledCount: number;
  activeStaffCount: number;
  onDuty: { staffId: string; staffName: string; method: string; since: string }[];
};

export async function getAttendanceOverview(): Promise<AttendanceOverview> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const [{ data: staff }, { data: openSessions }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, full_name, thumb_id, is_active")
      .eq("organization_id", org.organizationId)
      .eq("is_active", true),
    supabase
      .from("staff_attendance")
      .select("staff_id, method, check_in_at, staff:staff(id, full_name)")
      .eq("organization_id", org.organizationId)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
  ]);

  const activeStaff = staff ?? [];
  const enrolledCount = activeStaff.filter((s) => s.thumb_id).length;

  const onDuty = (openSessions ?? []).map((row) => {
    const staffRow = row.staff as unknown as { id: string; full_name: string } | null;
    return {
      staffId: staffRow?.id ?? row.staff_id,
      staffName: staffRow?.full_name ?? "Unknown",
      method: row.method,
      since: row.check_in_at,
    };
  });

  return {
    enrolledCount,
    activeStaffCount: activeStaff.length,
    onDuty,
  };
}

export async function getTodayAttendance() {
  const today = getLocalDateString();
  return getAttendanceReport(today, today);
}

export { recordManualAttendance };
