"use server";

import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { getAppointments } from "@/lib/actions/appointments";
import { getCustomers } from "@/lib/actions/customers";
import { getLowStockProducts } from "@/lib/actions/products";
import { getReportsSummary } from "@/lib/actions/reports";
import { getFinancialSummary } from "@/lib/actions/finances";
import { getLocalDateString, addLocalDays, startOfLocalDay } from "@/lib/dates/local";

export type DashboardAppointment = {
  id: string;
  scheduledAt: string;
  status: string;
  customerName: string;
  staffName: string | null;
  serviceName: string;
};

export type DashboardData = {
  todayRevenue: number;
  yesterdayRevenue: number;
  appointmentsToday: DashboardAppointment[];
  appointmentStats: {
    total: number;
    completed: number;
    upcoming: number;
    cancelled: number;
  };
  customerCount: number;
  newCustomersThisWeek: number;
  returningCustomers: number;
  averageSpend: number;
  retentionRate: number | null;
  lowStockCount: number;
  lowStockProducts: { id: string; name: string; stock: number; threshold: number }[];
  inventoryValueAtCost: number;
  productGrossProfitToday: number;
  stockToday: {
    unitsSold: number;
    retailRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    marginPercent: number;
    inventoryValueAtCost: number;
    inventoryValueAtRetail: number;
    inventoryUnitsOnHand: number;
    serviceRevenue: number;
    lowStockCount: number;
    productsSold: { name: string; qty: number; revenue: number; profit: number }[];
  };
  revenueByDay: { date: string; revenue: number }[];
  topServices: { name: string; qty: number; revenue: number }[];
  appointmentsByDay: { date: string; count: number }[];
  todayFinances: {
    salesRevenue: number;
    advancesCollected: number;
    totalExpenses: number;
    staffPayments: number;
    productCogs: number;
    productGrossProfit: number;
    productUnitsSold: number;
    productRetailRevenue: number;
    inventoryValueAtCost: number;
    netProfit: number;
    netCashFlow: number;
  } | null;
};

function mapAppointment(appt: Awaited<ReturnType<typeof getAppointments>>[number]): DashboardAppointment {
  const services = (appt as { services?: { service_name: string }[] }).services;
  return {
    id: appt.id,
    scheduledAt: appt.scheduled_at,
    status: appt.status,
    customerName: [appt.customer?.first_name, appt.customer?.last_name].filter(Boolean).join(" "),
    staffName: appt.staff?.full_name ?? null,
    serviceName: services?.[0]?.service_name ?? "Appointment",
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const todayStr = getLocalDateString();
  const yesterdayStr = addLocalDays(todayStr, -1);
  const weekAgo = startOfLocalDay(addLocalDays(todayStr, -7));
  const thirtyDaysAgo = startOfLocalDay(addLocalDays(todayStr, -30));

  const [
    todayFinancesRaw,
    yesterdayFinancesRaw,
    appointmentsRaw,
    customers,
    lowStockProducts,
    reports,
    salesWithCustomers,
    recentAppointments,
  ] = await Promise.all([
    getFinancialSummary(todayStr, todayStr).catch(() => null),
    getFinancialSummary(yesterdayStr, yesterdayStr).catch(() => null),
    getAppointments(todayStr).catch(() => []),
    getCustomers().catch(() => []),
    getLowStockProducts().catch(() => []),
    getReportsSummary().catch(() => ({
      totalRevenue: 0,
      saleCount: 0,
      revenueByDay: [] as { date: string; revenue: number }[],
      topItems: [] as { name: string; qty: number; revenue: number }[],
    })),
    (async () => {
      const { data } = await supabase
        .from("sales")
        .select("customer_id, total")
        .eq("organization_id", org.organizationId)
        .in("status", ["COMPLETED", "AMENDED"])
        .not("customer_id", "is", null);
      return data ?? [];
    })().catch(() => [] as { customer_id: string; total: number }[]),
    (async () => {
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_at")
        .eq("organization_id", org.organizationId)
        .gte("scheduled_at", thirtyDaysAgo.toISOString());
      return data ?? [];
    })().catch(() => [] as { scheduled_at: string }[]),
  ]);

  const todayRevenue = todayFinancesRaw?.salesRevenue ?? 0;
  const yesterdayRevenue = yesterdayFinancesRaw?.salesRevenue ?? 0;

  const appointments = appointmentsRaw.map(mapAppointment);

  const completedStatuses = new Set(["COMPLETED", "CHECKED_IN", "IN_PROGRESS"]);
  const upcomingStatuses = new Set(["SCHEDULED", "CONFIRMED"]);

  const appointmentStats = {
    total: appointments.length,
    completed: appointments.filter((a: DashboardAppointment) => completedStatuses.has(a.status)).length,
    upcoming: appointments.filter((a: DashboardAppointment) => upcomingStatuses.has(a.status)).length,
    cancelled: appointments.filter((a: DashboardAppointment) => a.status === "CANCELLED" || a.status === "NO_SHOW").length,
  };

  const newCustomersThisWeek = customers.filter(
    (c: { created_at: string }) => new Date(c.created_at) >= weekAgo
  ).length;

  const customerSaleCounts = new Map<string, number>();
  let totalSpend = 0;
  for (const sale of salesWithCustomers) {
    if (!sale.customer_id) continue;
    customerSaleCounts.set(
      sale.customer_id,
      (customerSaleCounts.get(sale.customer_id) ?? 0) + 1
    );
    totalSpend += Number(sale.total);
  }
  const customersWithSales = customerSaleCounts.size;
  const returningCustomers = [...customerSaleCounts.values()].filter((c) => c > 1).length;
  const averageSpend = customersWithSales > 0 ? totalSpend / customersWithSales : 0;
  const retentionRate =
    customersWithSales > 0 ? (returningCustomers / customersWithSales) * 100 : null;

  const appointmentsByDayMap: Record<string, number> = {};
  for (const appt of recentAppointments) {
    const day = appt.scheduled_at.slice(0, 10);
    appointmentsByDayMap[day] = (appointmentsByDayMap[day] ?? 0) + 1;
  }
  const appointmentsByDay = Object.entries(appointmentsByDayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));

  const topServices = reports.topItems
    .filter((i: { name: string }) => i.name)
    .slice(0, 5)
    .map((i: { name: string; qty: number; revenue: number }) => ({
      name: i.name,
      qty: i.qty,
      revenue: i.revenue,
    }));

  return {
    todayRevenue,
    yesterdayRevenue,
    appointmentsToday: appointments.slice(0, 8),
    appointmentStats,
    customerCount: customers.length,
    newCustomersThisWeek,
    returningCustomers,
    averageSpend,
    retentionRate,
    lowStockCount: lowStockProducts.length,
    lowStockProducts: lowStockProducts.slice(0, 5),
    revenueByDay: reports.revenueByDay.slice(-30),
    topServices,
    appointmentsByDay,
    todayFinances: todayFinancesRaw
      ? {
          salesRevenue: todayFinancesRaw.salesRevenue,
          advancesCollected: todayFinancesRaw.advancesCollected,
          totalExpenses: todayFinancesRaw.totalExpenses,
          staffPayments: todayFinancesRaw.staffPayments,
          productCogs: todayFinancesRaw.productCogs,
          productGrossProfit: todayFinancesRaw.productGrossProfit,
          productUnitsSold: todayFinancesRaw.productUnitsSold,
          productRetailRevenue: todayFinancesRaw.productRetailRevenue,
          inventoryValueAtCost: todayFinancesRaw.inventoryValueAtCost,
          netProfit: todayFinancesRaw.netProfit,
          netCashFlow: todayFinancesRaw.netCashFlow,
        }
      : null,
    inventoryValueAtCost: todayFinancesRaw?.inventoryValueAtCost ?? 0,
    productGrossProfitToday: todayFinancesRaw?.productGrossProfit ?? 0,
    stockToday: {
      unitsSold: todayFinancesRaw?.productUnitsSold ?? 0,
      retailRevenue: todayFinancesRaw?.productRetailRevenue ?? 0,
      costOfGoodsSold: todayFinancesRaw?.productCogs ?? 0,
      grossProfit: todayFinancesRaw?.productGrossProfit ?? 0,
      marginPercent: todayFinancesRaw?.productMarginPercent ?? 0,
      inventoryValueAtCost: todayFinancesRaw?.inventoryValueAtCost ?? 0,
      inventoryValueAtRetail: todayFinancesRaw?.inventoryValueAtRetail ?? 0,
      inventoryUnitsOnHand: todayFinancesRaw?.inventoryUnitsOnHand ?? 0,
      serviceRevenue: todayFinancesRaw?.serviceRevenue ?? 0,
      lowStockCount: lowStockProducts.length,
      productsSold: (todayFinancesRaw?.productSaleRows ?? []).slice(0, 5).map((r) => ({
        name: r.name,
        qty: r.qtySold,
        revenue: r.retailRevenue,
        profit: r.grossProfit,
      })),
    },
  };
}
