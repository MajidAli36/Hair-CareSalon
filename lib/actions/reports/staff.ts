"use server";

import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";

export type StaffPerformanceRow = {
  staffId: string | null;
  name: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
  linkedSalesRevenue: number;
  customersServed: number;
};

export type StaffReport = {
  from: string;
  to: string;
  generatedAt: string;
  kpis: {
    staffRevenue: CompareResult;
    servicesPerformed: CompareResult;
    appointmentsCompleted: CompareResult;
    avgTicket: CompareResult;
    unassignedRevenue: CompareResult;
  };
  ranking: StaffPerformanceRow[];
  notes: string[];
};

function resolveSaleStaffId(
  sale: { staff_id: string | null; appointment_id: string | null },
  apptStaff: Map<string, string | null>
): string | null {
  if (sale.staff_id) return sale.staff_id;
  if (sale.appointment_id) return apptStaff.get(sale.appointment_id) ?? null;
  return null;
}

export async function getStaffReport(from?: string, to?: string): Promise<StaffReport> {
  const ctx = await createReportContext(from, to);
  const supabase = await getSupabase();

  const [{ data: staffRows }, { data: appts }, { data: prevAppts }, curSales, prevSales] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, full_name, is_active")
        .eq("organization_id", ctx.organizationId)
        .eq("is_active", true),
      supabase
        .from("appointments")
        .select("id, staff_id, customer_id, status")
        .eq("organization_id", ctx.organizationId)
        .gte("scheduled_at", ctx.start.toISOString())
        .lte("scheduled_at", ctx.end.toISOString()),
      supabase
        .from("appointments")
        .select("id, status")
        .eq("organization_id", ctx.organizationId)
        .gte("scheduled_at", ctx.prevStart.toISOString())
        .lte("scheduled_at", ctx.prevEnd.toISOString()),
      fetchCompletedSales(ctx, "current"),
      fetchCompletedSales(ctx, "previous"),
    ]);

  const staff = staffRows ?? [];
  const appointments = appts ?? [];
  const prevCompleted = (prevAppts ?? []).filter((a) => a.status === "COMPLETED").length;

  const apptStaff = new Map(
    appointments.map((a) => [a.id, a.staff_id as string | null])
  );

  const needApptIds = [
    ...new Set(
      [...curSales, ...prevSales]
        .filter((s) => !s.staff_id && s.appointment_id)
        .map((s) => s.appointment_id as string)
        .filter((id) => !apptStaff.has(id))
    ),
  ];
  if (needApptIds.length) {
    for (let i = 0; i < needApptIds.length; i += 200) {
      const chunk = needApptIds.slice(i, i + 200);
      const { data } = await supabase
        .from("appointments")
        .select("id, staff_id")
        .eq("organization_id", ctx.organizationId)
        .in("id", chunk);
      for (const a of data ?? []) apptStaff.set(a.id, a.staff_id);
    }
  }

  const revenueByStaff = new Map<string | null, number>();
  const customersByStaff = new Map<string | null, Set<string>>();
  let unassigned = 0;
  let prevUnassigned = 0;
  let assignedTotal = 0;
  let prevAssignedTotal = 0;

  for (const sale of curSales) {
    const sid = resolveSaleStaffId(sale, apptStaff);
    if (sid) {
      revenueByStaff.set(sid, (revenueByStaff.get(sid) ?? 0) + sale.total);
      assignedTotal += sale.total;
      if (sale.customer_id) {
        const set = customersByStaff.get(sid) ?? new Set();
        set.add(sale.customer_id);
        customersByStaff.set(sid, set);
      }
    } else {
      unassigned += sale.total;
    }
  }

  for (const sale of prevSales) {
    const sid = resolveSaleStaffId(sale, apptStaff);
    if (sid) prevAssignedTotal += sale.total;
    else prevUnassigned += sale.total;
  }

  const ranking: StaffPerformanceRow[] = staff.map((s) => {
    const mine = appointments.filter((a) => a.staff_id === s.id);
    const completed = mine.filter((a) => a.status === "COMPLETED").length;
    const cancelled = mine.filter((a) => a.status === "CANCELLED").length;
    const noShow = mine.filter((a) => a.status === "NO_SHOW").length;
    const revenue = revenueByStaff.get(s.id) ?? 0;
    return {
      staffId: s.id,
      name: s.full_name,
      appointments: mine.length,
      completed,
      cancelled,
      noShow,
      completionRate: mine.length ? (completed / mine.length) * 100 : 0,
      linkedSalesRevenue: revenue,
      customersServed: customersByStaff.get(s.id)?.size ?? 0,
    };
  });

  ranking.sort((a, b) => b.linkedSalesRevenue - a.linkedSalesRevenue);

  const completedAppts = appointments.filter((a) => a.status === "COMPLETED").length;
  const assignedSaleCount = curSales.filter((s) => resolveSaleStaffId(s, apptStaff)).length;
  const prevAssignedSaleCount = prevSales.filter((s) =>
    resolveSaleStaffId(s, apptStaff)
  ).length;
  const avgTicket = assignedSaleCount ? assignedTotal / assignedSaleCount : 0;
  const prevAvg = prevAssignedSaleCount ? prevAssignedTotal / prevAssignedSaleCount : 0;

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      staffRevenue: cmp(assignedTotal, prevAssignedTotal),
      servicesPerformed: cmp(completedAppts, prevCompleted),
      appointmentsCompleted: cmp(completedAppts, prevCompleted),
      avgTicket: cmp(avgTicket, prevAvg),
      unassignedRevenue: cmp(unassigned, prevUnassigned),
    },
    ranking,
    notes: [
      "Staff revenue uses the Served by stylist on the sale when set; otherwise the appointment stylist.",
      "Walk-in POS sales without Served by appear as Unassigned revenue.",
      "Commissions and salary costs are not modeled — see Finances for staff payments.",
    ],
  };
}
