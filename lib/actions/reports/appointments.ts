"use server";

import { formatCustomerName } from "@/lib/format";
import { isoToLocalDateString } from "@/lib/dates/local";
import {
  cmp,
  createReportContext,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type AppointmentLedgerRow = {
  id: string;
  scheduledAt: string;
  customerName: string;
  staffName: string | null;
  status: string;
  services: string;
  source: string;
};

export type AppointmentsReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    total: CompareResult;
    completed: CompareResult;
    pending: CompareResult;
    confirmed: CompareResult;
    cancelled: CompareResult;
    noShow: CompareResult;
    completionRate: CompareResult;
    cancellationRate: CompareResult;
    noShowRate: CompareResult;
  };
  byDay: { label: string; value: number }[];
  byStatus: { name: string; value: number }[];
  byStaff: { name: string; value: number }[];
  byService: { name: string; value: number }[];
  heatmap: { day: number; hour: number; count: number }[];
  ledger: AppointmentLedgerRow[];
};

const PENDING_STATUSES = new Set(["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"]);

export async function getAppointmentsReport(
  from?: string,
  to?: string
): Promise<AppointmentsReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [{ data: cur }, { data: prev }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, scheduled_at, status, source, customer_id, staff_id, customer:customers(first_name, last_name), staff:staff(full_name)"
      )
      .eq("organization_id", ctx.organizationId)
      .gte("scheduled_at", ctx.start.toISOString())
      .lte("scheduled_at", ctx.end.toISOString()),
    supabase
      .from("appointments")
      .select("id, status")
      .eq("organization_id", ctx.organizationId)
      .gte("scheduled_at", ctx.prevStart.toISOString())
      .lte("scheduled_at", ctx.prevEnd.toISOString()),
  ]);

  const appointments = cur ?? [];
  const prevAppts = prev ?? [];
  const ids = appointments.map((a) => a.id);

  const servicesByAppt = new Map<string, { name: string; price: number }[]>();
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: svc } = await supabase
        .from("appointment_services")
        .select("appointment_id, service_name, price")
        .in("appointment_id", chunk);
      for (const row of svc ?? []) {
        const list = servicesByAppt.get(row.appointment_id) ?? [];
        list.push({ name: row.service_name, price: Number(row.price) || 0 });
        servicesByAppt.set(row.appointment_id, list);
      }
    }
  }

  const countStatus = (rows: { status: string }[], status: string) =>
    rows.filter((r) => r.status === status).length;
  const countPending = (rows: { status: string }[]) =>
    rows.filter((r) => PENDING_STATUSES.has(r.status)).length;

  const total = appointments.length;
  const prevTotal = prevAppts.length;
  const completed = countStatus(appointments, "COMPLETED");
  const prevCompleted = countStatus(prevAppts, "COMPLETED");
  const cancelled = countStatus(appointments, "CANCELLED");
  const prevCancelled = countStatus(prevAppts, "CANCELLED");
  const noShow = countStatus(appointments, "NO_SHOW");
  const prevNoShow = countStatus(prevAppts, "NO_SHOW");
  const confirmed = countStatus(appointments, "CONFIRMED");
  const prevConfirmed = countStatus(prevAppts, "CONFIRMED");
  const pending = countPending(appointments);
  const prevPending = countPending(prevAppts);

  const rate = (n: number, d: number) => (d ? (n / d) * 100 : 0);

  const byDay: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byStaff: Record<string, number> = {};
  const byService: Record<string, number> = {};
  const heatmapMap = new Map<string, number>();

  for (const a of appointments) {
    const day = isoToLocalDateString(a.scheduled_at);
    byDay[day] = (byDay[day] ?? 0) + 1;
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;

    const staffRel = a.staff as unknown as { full_name: string } | { full_name: string }[] | null;
    const staffName = Array.isArray(staffRel)
      ? staffRel[0]?.full_name
      : staffRel?.full_name;
    const staffKey = staffName ?? "Unassigned";
    byStaff[staffKey] = (byStaff[staffKey] ?? 0) + 1;

    const d = new Date(a.scheduled_at);
    const key = `${d.getDay()}-${d.getHours()}`;
    heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1);

    for (const s of servicesByAppt.get(a.id) ?? []) {
      byService[s.name] = (byService[s.name] ?? 0) + 1;
    }
  }

  const ledger: AppointmentLedgerRow[] = appointments
    .slice()
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
    .map((a) => {
      const cust = a.customer as unknown as
        | { first_name: string; last_name: string | null }
        | { first_name: string; last_name: string | null }[]
        | null;
      const customer = Array.isArray(cust) ? cust[0] : cust;
      const staffRel = a.staff as unknown as { full_name: string } | { full_name: string }[] | null;
      const staffName = Array.isArray(staffRel)
        ? staffRel[0]?.full_name ?? null
        : staffRel?.full_name ?? null;
      return {
        id: a.id,
        scheduledAt: a.scheduled_at,
        customerName: customer
          ? formatCustomerName(customer.first_name, customer.last_name)
          : "Customer",
        staffName,
        status: a.status,
        services: (servicesByAppt.get(a.id) ?? []).map((s) => s.name).join(", "),
        source: a.source,
      };
    });

  const heatmap: AppointmentsReport["heatmap"] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour <= 21; hour++) {
      heatmap.push({
        day,
        hour,
        count: heatmapMap.get(`${day}-${hour}`) ?? 0,
      });
    }
  }

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      total: cmp(total, prevTotal),
      completed: cmp(completed, prevCompleted),
      pending: cmp(pending, prevPending),
      confirmed: cmp(confirmed, prevConfirmed),
      cancelled: cmp(cancelled, prevCancelled),
      noShow: cmp(noShow, prevNoShow),
      completionRate: cmp(rate(completed, total), rate(prevCompleted, prevTotal)),
      cancellationRate: cmp(rate(cancelled, total), rate(prevCancelled, prevTotal)),
      noShowRate: cmp(rate(noShow, total), rate(prevNoShow, prevTotal)),
    },
    byDay: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value })),
    byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
    byStaff: Object.entries(byStaff)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    byService: Object.entries(byService)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ name, value })),
    heatmap,
    ledger,
  };
}
