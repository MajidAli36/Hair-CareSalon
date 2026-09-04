export type BookableSlot = {
  iso: string;
  label: string;
  staffId: string;
  staffName: string;
};

type StaffRow = { id: string; full_name: string; online_booking_enabled?: boolean };
type ScheduleRow = { staff_id: string; day_of_week: number; start_time: string; end_time: string };
type AppointmentRow = {
  id: string;
  staff_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
};

import { isSameLocalDay } from "@/lib/booking/dates";
import { getLocalDateString } from "@/lib/dates/local";
import { formatTime } from "@/lib/format";

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "18:00";

export function timeToMinutes(time: string): number {
  const parts = time.slice(0, 5).split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(
  aStart: number,
  aDuration: number,
  bStart: number,
  bDuration: number
): boolean {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

export function computeAvailableSlots(params: {
  date: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  staff: StaffRow[];
  schedules: ScheduleRow[];
  appointments: AppointmentRow[];
  staffId?: string | null;
  excludeAppointmentId?: string;
  maxDaysAhead?: number;
  onlineOnly?: boolean;
}): BookableSlot[] {
  const {
    date,
    durationMinutes,
    slotIntervalMinutes,
    staff,
    schedules,
    appointments,
    staffId,
    excludeAppointmentId,
    maxDaysAhead = 30,
    onlineOnly = false,
  } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const dayDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(dayDate.getTime())) return [];

  const todayStr = getLocalDateString();
  const maxAnchor = new Date(`${todayStr}T12:00:00`);
  maxAnchor.setDate(maxAnchor.getDate() + maxDaysAhead);
  const maxDateStr = getLocalDateString(maxAnchor);
  if (date < todayStr || date > maxDateStr) return [];

  const dayOfWeek = dayDate.getDay();
  const scheduleByStaff = new Map<string, ScheduleRow>();
  for (const s of schedules) {
    if (s.day_of_week === dayOfWeek) scheduleByStaff.set(s.staff_id, s);
  }

  const dayAppointments = appointments.filter((a) => {
    if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
    return isSameLocalDay(a.scheduled_at, date);
  });

  let targetStaff = staffId ? staff.filter((s) => s.id === staffId) : staff;
  if (onlineOnly) {
    targetStaff = targetStaff.filter((s) => s.online_booking_enabled);
  }
  const slots: BookableSlot[] = [];
  const now = new Date();

  for (const member of targetStaff) {
    const sched = scheduleByStaff.get(member.id);
    const openMin = timeToMinutes(sched?.start_time ?? DEFAULT_OPEN);
    const closeMin = timeToMinutes(sched?.end_time ?? DEFAULT_CLOSE);
    if (closeMin - openMin < durationMinutes) continue;

    for (let startMin = openMin; startMin + durationMinutes <= closeMin; startMin += slotIntervalMinutes) {
      const slotDate = new Date(`${date}T${minutesToTime(startMin)}:00`);
      if (slotDate < now) continue;

      const conflict = dayAppointments.some((appt) => {
        const apptStart = new Date(appt.scheduled_at);
        const apptStartMin = apptStart.getHours() * 60 + apptStart.getMinutes();
        const blocksStaff = appt.staff_id === null || appt.staff_id === member.id;
        if (!blocksStaff) return false;
        return overlaps(startMin, durationMinutes, apptStartMin, appt.duration_minutes);
      });

      if (!conflict) {
        slots.push({
          iso: slotDate.toISOString(),
          label: formatTime(slotDate),
          staffId: member.id,
          staffName: member.full_name,
        });
      }
    }
  }

  return slots.sort((a, b) => a.iso.localeCompare(b.iso));
}

export function sumServiceDuration(
  services: { duration_minutes: number }[],
  fallback = 30
): number {
  if (!services.length) return fallback;
  return services.reduce((sum, s) => sum + Number(s.duration_minutes), 0);
}
