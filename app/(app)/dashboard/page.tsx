import {
  Calendar,
  Package,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboardData } from "@/lib/actions/dashboard";
import { getActiveOrganization } from "@/lib/auth/organization";
import { requireAuth } from "@/lib/auth/session";
import { formatCurrency, formatPercentChange } from "@/lib/format";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AppointmentList } from "@/components/dashboard/appointment-list";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { CustomerInsights } from "@/components/dashboard/customer-insights";
import { ServicePerformance } from "@/components/dashboard/service-performance";
import { DashboardStockPanel } from "@/components/dashboard/dashboard-stock-panel";
import { InventoryAlerts } from "@/components/dashboard/inventory-alerts";

export default async function DashboardPage() {
  const user = await requireAuth();
  const org = await getActiveOrganization();
  const data = await getDashboardData().catch(() => null);

  const revenueChange = data
    ? formatPercentChange(data.todayRevenue, data.yesterdayRevenue)
    : "0%";
  const revenueChangeType =
    data && data.todayRevenue >= data.yesterdayRevenue ? "positive" : "negative";

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <DashboardHeader organizationName={org?.organizationName} userEmail={user.email} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(data?.todayRevenue ?? 0)}
          change={revenueChange}
          changeType={data?.yesterdayRevenue ? revenueChangeType : "neutral"}
          subtext="vs yesterday"
          icon={Wallet}
          iconClassName="bg-primary/10 [&_svg]:text-primary"
        />
        <StatCard
          label="Appointments"
          value={String(data?.appointmentStats.total ?? 0)}
          subtext={`${data?.appointmentStats.completed ?? 0} completed · ${data?.appointmentStats.upcoming ?? 0} upcoming`}
          icon={Calendar}
          iconClassName="bg-accent"
        />
        <StatCard
          label="Customers"
          value={String(data?.customerCount ?? 0)}
          subtext={
            data?.newCustomersThisWeek
              ? `+${data.newCustomersThisWeek} this week`
              : "Active customers"
          }
          change={data?.newCustomersThisWeek ? `+${data.newCustomersThisWeek}` : undefined}
          changeType="positive"
          icon={Users}
        />
        <StatCard
          label={data?.stockToday.unitsSold ? "Stock sold today" : "Stock on hand"}
          value={
            data?.stockToday.unitsSold
              ? formatCurrency(data.stockToday.retailRevenue)
              : formatCurrency(data?.stockToday.inventoryValueAtCost ?? 0)
          }
          subtext={
            data?.stockToday.unitsSold
              ? `${data.stockToday.unitsSold} units · ${formatCurrency(data.stockToday.grossProfit)} profit`
              : data?.stockToday.inventoryUnitsOnHand
                ? `${data.stockToday.inventoryUnitsOnHand} units in inventory`
                : data?.lowStockCount
                  ? `${data.lowStockCount} low stock`
                  : "No stock yet"
          }
          icon={Package}
          iconClassName={
            data?.stockToday.unitsSold
              ? "bg-primary/10 [&_svg]:text-primary"
              : data?.lowStockCount
                ? "bg-[#d97706]/10 [&_svg]:text-[#d97706]"
                : "bg-[#16a34a]/10 [&_svg]:text-[#16a34a]"
          }
        />
      </div>

      {data && <DashboardStockPanel stock={data.stockToday} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AppointmentList appointments={data?.appointmentsToday ?? []} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions
            stats={
              data?.appointmentStats ?? {
                total: 0,
                completed: 0,
                upcoming: 0,
                cancelled: 0,
              }
            }
            todayFinances={data?.todayFinances ?? null}
          />
        </div>
      </div>

      {data && (
        <RevenueChart
          revenueByDay={data.revenueByDay}
          appointmentsByDay={data.appointmentsByDay}
        />
      )}

      <CustomerInsights
        totalCustomers={data?.customerCount ?? 0}
        newThisWeek={data?.newCustomersThisWeek ?? 0}
        returning={data?.returningCustomers ?? 0}
        averageSpend={data?.averageSpend ?? 0}
        retentionRate={data?.retentionRate ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ServicePerformance services={data?.topServices ?? []} />
        <InventoryAlerts products={data?.lowStockProducts ?? []} />
      </div>
    </div>
  );
}
