"use server";

import {
  cmp,
  createReportContext,
  fetchCompletedSales,
  getSupabase,
} from "@/lib/reports/context";
import type { CompareResult } from "@/lib/reports/range";
import type { CompletedSaleRow } from "@/lib/reports/context";
import {
  addLocalDays,
  endOfLocalDay,
  getLocalDateString,
  isoToLocalDateString,
  startOfLocalDay,
} from "@/lib/dates/local";
import { requireOrganization } from "@/lib/auth/organization";
import type { StaffNoteType } from "@/lib/actions/staff-notes";
import { roundMoney, splitEqually } from "@/lib/sales/calculate";

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

function resolveFallbackStaffId(
  sale: { staff_id: string | null; appointment_id: string | null },
  apptStaff: Map<string, string | null>
): string | null {
  if (sale.staff_id) return sale.staff_id;
  if (sale.appointment_id) return apptStaff.get(sale.appointment_id) ?? null;
  return null;
}

/** Staff ids credited on a sale: sale_staff rows, else primary/appointment fallback. */
function staffIdsForSale(
  sale: CompletedSaleRow,
  saleStaffMap: Map<string, string[]>,
  apptStaff: Map<string, string | null>
): string[] {
  const linked = saleStaffMap.get(sale.id);
  if (linked && linked.length > 0) return linked;
  const fallback = resolveFallbackStaffId(sale, apptStaff);
  return fallback ? [fallback] : [];
}

async function loadSaleStaffMap(
  organizationId: string,
  saleIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!saleIds.length) return map;
  const supabase = await getSupabase();
  for (let i = 0; i < saleIds.length; i += 200) {
    const chunk = saleIds.slice(i, i + 200);
    const { data } = await supabase
      .from("sale_staff")
      .select("sale_id, staff_id")
      .eq("organization_id", organizationId)
      .in("sale_id", chunk);
    for (const row of data ?? []) {
      const list = map.get(row.sale_id) ?? [];
      list.push(row.staff_id);
      map.set(row.sale_id, list);
    }
  }
  return map;
}

function creditEqualShare(
  sales: CompletedSaleRow[],
  saleStaffMap: Map<string, string[]>,
  apptStaff: Map<string, string | null>,
  revenueByStaff: Map<string | null, number>,
  customersByStaff?: Map<string | null, Set<string>>
): { assignedTotal: number; unassigned: number; assignedSaleCount: number } {
  let assignedTotal = 0;
  let unassigned = 0;
  let assignedSaleCount = 0;

  for (const sale of sales) {
    const ids = staffIdsForSale(sale, saleStaffMap, apptStaff);
    if (!ids.length) {
      unassigned = roundMoney(unassigned + sale.total);
      continue;
    }
    assignedSaleCount += 1;
    assignedTotal = roundMoney(assignedTotal + sale.total);
    const ordered = [...ids].sort();
    const shares = splitEqually(sale.total, ordered.length);
    ordered.forEach((sid, idx) => {
      revenueByStaff.set(sid, roundMoney((revenueByStaff.get(sid) ?? 0) + shares[idx]));
      if (customersByStaff && sale.customer_id) {
        const set = customersByStaff.get(sid) ?? new Set();
        set.add(sale.customer_id);
        customersByStaff.set(sid, set);
      }
    });
  }

  return {
    assignedTotal: roundMoney(assignedTotal),
    unassigned: roundMoney(unassigned),
    assignedSaleCount,
  };
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

  const allSaleIds = [...new Set([...curSales, ...prevSales].map((s) => s.id))];
  const saleStaffMap = await loadSaleStaffMap(ctx.organizationId, allSaleIds);

  const revenueByStaff = new Map<string | null, number>();
  const customersByStaff = new Map<string | null, Set<string>>();
  const prevRevenueByStaff = new Map<string | null, number>();

  const cur = creditEqualShare(
    curSales,
    saleStaffMap,
    apptStaff,
    revenueByStaff,
    customersByStaff
  );
  const prev = creditEqualShare(prevSales, saleStaffMap, apptStaff, prevRevenueByStaff);

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
  const avgTicket = cur.assignedSaleCount ? cur.assignedTotal / cur.assignedSaleCount : 0;
  const prevAvg = prev.assignedSaleCount ? prev.assignedTotal / prev.assignedSaleCount : 0;

  return {
    from: ctx.from,
    to: ctx.to,
    generatedAt: new Date().toISOString(),
    kpis: {
      staffRevenue: cmp(cur.assignedTotal, prev.assignedTotal),
      servicesPerformed: cmp(completedAppts, prevCompleted),
      appointmentsCompleted: cmp(completedAppts, prevCompleted),
      avgTicket: cmp(avgTicket, prevAvg),
      unassignedRevenue: cmp(cur.unassigned, prev.unassigned),
    },
    ranking,
    notes: [
      "Staff revenue splits equally when multiple stylists are selected on Served by.",
      "Legacy sales without multi-staff use the primary Served by or appointment stylist.",
      "Walk-in POS sales without Served by appear as Unassigned revenue.",
      "Commissions and salary costs are not modeled — see Finances for staff payments.",
    ],
  };
}

export type StaffMonthlyDetail = {
  staffId: string;
  name: string;
  yearMonth: string;
  from: string;
  to: string;
  revenue: number;
  salesCount: number;
  customersServed: number;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
  payments: {
    id: string;
    amount: number;
    paymentType: string;
    paymentDate: string;
    notes: string | null;
  }[];
  paymentsTotal: number;
  attendance: {
    sessions: number;
    completedSessions: number;
    openSessions: number;
    workingDays: number;
    totalDutyMinutes: number;
    avgDutyMinutes: number;
    avgDutyMinutesPerDay: number;
    avgDutyHours: number;
    totalDutyHours: number;
    recentSessions: {
      id: string;
      checkInAt: string;
      checkOutAt: string | null;
      durationMinutes: number | null;
      method: string;
    }[];
  };
  conduct: {
    score: number;
    label: string;
    warnings: number;
    complaints: number;
    praise: number;
    notes: number;
    entries: {
      id: string;
      noteType: StaffNoteType;
      title: string;
      details: string | null;
      severity: number;
      occurredOn: string;
      createdAt: string;
    }[];
  };
};

function sessionDurationMinutes(checkIn: string, checkOut: string | null) {
  if (!checkOut) return null;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function conductScore(entries: { noteType: StaffNoteType; severity: number }[]) {
  let score = 100;
  for (const e of entries) {
    if (e.noteType === "WARNING") score -= 8 * e.severity;
    else if (e.noteType === "COMPLAINT") score -= 12 * e.severity;
    else if (e.noteType === "PRAISE") score += 5 * e.severity;
  }
  score = Math.max(0, Math.min(100, score));
  let label = "Excellent";
  if (score < 40) label = "Needs attention";
  else if (score < 60) label = "Fair";
  else if (score < 80) label = "Good";
  else if (score < 90) label = "Very good";
  return { score, label };
}

function monthRange(yearMonth: string): { from: string; to: string; start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) {
    const fallback = getLocalDateString().slice(0, 7);
    return monthRange(fallback);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const from = `${match[1]}-${match[2]}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextFirst = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const to = addLocalDays(nextFirst, -1);
  return {
    from,
    to,
    start: startOfLocalDay(from),
    end: endOfLocalDay(to),
  };
}

export async function getStaffMonthlyDetail(
  staffId: string,
  yearMonth?: string
): Promise<StaffMonthlyDetail | null> {
  const org = await requireOrganization();
  const supabase = await getSupabase();
  const ym = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
    ? yearMonth
    : getLocalDateString().slice(0, 7);
  const { from, to, start, end } = monthRange(ym);

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id, full_name")
    .eq("organization_id", org.organizationId)
    .eq("id", staffId)
    .maybeSingle();

  if (!staffRow) return null;

  const [{ data: appts }, { data: saleStaffRows }, { data: payments }, { data: attendanceRows }, { data: noteRows }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, status")
        .eq("organization_id", org.organizationId)
        .eq("staff_id", staffId)
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString()),
      supabase
        .from("sale_staff")
        .select("sale_id")
        .eq("organization_id", org.organizationId)
        .eq("staff_id", staffId),
      supabase
        .from("staff_payments")
        .select("id, amount, payment_type, payment_date, notes")
        .eq("organization_id", org.organizationId)
        .eq("staff_id", staffId)
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: false }),
      supabase
        .from("staff_attendance")
        .select("id, check_in_at, check_out_at, method")
        .eq("organization_id", org.organizationId)
        .eq("staff_id", staffId)
        .gte("check_in_at", start.toISOString())
        .lte("check_in_at", end.toISOString())
        .order("check_in_at", { ascending: false }),
      supabase
        .from("staff_notes")
        .select("id, note_type, title, details, severity, occurred_on, created_at")
        .eq("organization_id", org.organizationId)
        .eq("staff_id", staffId)
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("occurred_on", { ascending: false }),
    ]);

  const appointments = appts ?? [];
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;
  const noShow = appointments.filter((a) => a.status === "NO_SHOW").length;

  const multiSaleIds = [...new Set((saleStaffRows ?? []).map((r) => r.sale_id))];

  // Match getStaffReport attribution:
  // 1) sale_staff rows → equal share
  // 2) else sales.staff_id
  // 3) else appointment stylist
  const saleMap = new Map<string, { total: number; customer_id: string | null; shareOf: number }>();

  let multiSales: { id: string; total: number; customer_id: string | null }[] = [];
  if (multiSaleIds.length) {
    for (let i = 0; i < multiSaleIds.length; i += 200) {
      const chunk = multiSaleIds.slice(i, i + 200);
      const { data } = await supabase
        .from("sales")
        .select("id, total, customer_id, completed_at, status")
        .eq("organization_id", org.organizationId)
        .in("id", chunk)
        .in("status", ["COMPLETED", "AMENDED"])
        .gte("completed_at", start.toISOString())
        .lte("completed_at", end.toISOString());
      multiSales = multiSales.concat(
        (data ?? []).map((s) => ({
          id: s.id,
          total: Number(s.total),
          customer_id: s.customer_id,
        }))
      );
    }
  }

  const staffIdsBySale = new Map<string, string[]>();
  if (multiSaleIds.length) {
    for (let i = 0; i < multiSaleIds.length; i += 200) {
      const chunk = multiSaleIds.slice(i, i + 200);
      const { data } = await supabase
        .from("sale_staff")
        .select("sale_id, staff_id")
        .eq("organization_id", org.organizationId)
        .in("sale_id", chunk);
      for (const row of data ?? []) {
        const list = staffIdsBySale.get(row.sale_id) ?? [];
        list.push(row.staff_id);
        staffIdsBySale.set(row.sale_id, list);
      }
    }
  }

  for (const s of multiSales) {
    const ids = [...new Set(staffIdsBySale.get(s.id) ?? [])].sort();
    const n = ids.length || 1;
    const idx = Math.max(0, ids.indexOf(staffId));
    const shares = splitEqually(s.total, n);
    saleMap.set(s.id, {
      total: shares[idx] ?? roundMoney(s.total / n),
      customer_id: s.customer_id,
      shareOf: 1,
    });
  }

  const { data: salesByPrimary } = await supabase
    .from("sales")
    .select("id, total, customer_id, staff_id, appointment_id, completed_at, status")
    .eq("organization_id", org.organizationId)
    .eq("staff_id", staffId)
    .in("status", ["COMPLETED", "AMENDED"])
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  const primaryCandidates = (salesByPrimary ?? []).filter((s) => !saleMap.has(s.id));
  if (primaryCandidates.length) {
    const primaryIds = primaryCandidates.map((s) => s.id);
    const hasSaleStaff = new Set<string>();
    for (let i = 0; i < primaryIds.length; i += 200) {
      const chunk = primaryIds.slice(i, i + 200);
      const { data } = await supabase
        .from("sale_staff")
        .select("sale_id")
        .eq("organization_id", org.organizationId)
        .in("sale_id", chunk);
      for (const row of data ?? []) hasSaleStaff.add(row.sale_id);
    }
    for (const s of primaryCandidates) {
      // If sale_staff exists, primary-only fallback must not credit this staff
      if (hasSaleStaff.has(s.id)) continue;
      saleMap.set(s.id, {
        total: Number(s.total),
        customer_id: s.customer_id,
        shareOf: 1,
      });
    }
  }

  // Appointment stylist fallback (no sale_staff, no sales.staff_id)
  const myApptIds = appointments.map((a) => a.id);
  if (myApptIds.length) {
    for (let i = 0; i < myApptIds.length; i += 200) {
      const chunk = myApptIds.slice(i, i + 200);
      const { data: apptSales } = await supabase
        .from("sales")
        .select("id, total, customer_id, staff_id, appointment_id")
        .eq("organization_id", org.organizationId)
        .in("appointment_id", chunk)
        .is("staff_id", null)
        .in("status", ["COMPLETED", "AMENDED"])
        .gte("completed_at", start.toISOString())
        .lte("completed_at", end.toISOString());

      const candidates = (apptSales ?? []).filter((s) => !saleMap.has(s.id));
      if (!candidates.length) continue;

      const candIds = candidates.map((s) => s.id);
      const hasSaleStaff = new Set<string>();
      const { data: ss } = await supabase
        .from("sale_staff")
        .select("sale_id")
        .eq("organization_id", org.organizationId)
        .in("sale_id", candIds);
      for (const row of ss ?? []) hasSaleStaff.add(row.sale_id);

      for (const s of candidates) {
        if (hasSaleStaff.has(s.id)) continue;
        saleMap.set(s.id, {
          total: Number(s.total),
          customer_id: s.customer_id,
          shareOf: 1,
        });
      }
    }
  }

  let revenue = 0;
  const customers = new Set<string>();
  for (const sale of saleMap.values()) {
    revenue = roundMoney(revenue + sale.total);
    if (sale.customer_id) customers.add(sale.customer_id);
  }

  const paymentRows = (payments ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paymentType: p.payment_type,
    paymentDate: p.payment_date,
    notes: p.notes,
  }));

  const attendanceRaw = attendanceRows ?? [];
  const workingDays = new Set(
    attendanceRaw.map((r) => isoToLocalDateString(r.check_in_at))
  );
  let totalDutyMinutes = 0;
  let completedSessions = 0;
  const recentSessions = attendanceRaw.map((r) => {
    const durationMinutes = sessionDurationMinutes(r.check_in_at, r.check_out_at);
    if (durationMinutes != null) {
      totalDutyMinutes += durationMinutes;
      completedSessions += 1;
    }
    return {
      id: r.id,
      checkInAt: r.check_in_at,
      checkOutAt: r.check_out_at,
      durationMinutes,
      method: r.method,
    };
  });
  const avgDutyMinutes =
    completedSessions > 0 ? Math.round(totalDutyMinutes / completedSessions) : 0;
  const avgDutyMinutesPerDay =
    workingDays.size > 0 ? Math.round(totalDutyMinutes / workingDays.size) : 0;

  const conductEntries = (noteRows ?? []).map((n) => ({
    id: n.id,
    noteType: n.note_type as StaffNoteType,
    title: n.title,
    details: n.details,
    severity: Number(n.severity) || 1,
    occurredOn: n.occurred_on,
    createdAt: n.created_at,
  }));
  const scored = conductScore(conductEntries);

  return {
    staffId: staffRow.id,
    name: staffRow.full_name,
    yearMonth: ym,
    from,
    to,
    revenue,
    salesCount: saleMap.size,
    customersServed: customers.size,
    appointments: appointments.length,
    completed,
    cancelled,
    noShow,
    completionRate: appointments.length ? (completed / appointments.length) * 100 : 0,
    payments: paymentRows,
    paymentsTotal: paymentRows.reduce((sum, p) => sum + p.amount, 0),
    attendance: {
      sessions: attendanceRaw.length,
      completedSessions,
      openSessions: attendanceRaw.length - completedSessions,
      workingDays: workingDays.size,
      totalDutyMinutes,
      avgDutyMinutes,
      avgDutyMinutesPerDay,
      avgDutyHours: Math.round((avgDutyMinutes / 60) * 10) / 10,
      totalDutyHours: Math.round((totalDutyMinutes / 60) * 10) / 10,
      recentSessions: recentSessions.slice(0, 12),
    },
    conduct: {
      score: scored.score,
      label: scored.label,
      warnings: conductEntries.filter((e) => e.noteType === "WARNING").length,
      complaints: conductEntries.filter((e) => e.noteType === "COMPLAINT").length,
      praise: conductEntries.filter((e) => e.noteType === "PRAISE").length,
      notes: conductEntries.filter((e) => e.noteType === "NOTE").length,
      entries: conductEntries,
    },
  };
}
