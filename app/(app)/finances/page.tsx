import { redirect } from "next/navigation";
import { getExpenses, getFinancialSummary } from "@/lib/actions/finances";
import { getStaffPayments } from "@/lib/actions/payroll";
import { getStaff } from "@/lib/actions/staff";
import { canViewReports } from "@/lib/auth/permissions";
import { FinancesDashboard } from "@/components/features/finances/finances-dashboard";
import { getLocalDateString } from "@/lib/dates/local";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function FinancesPage({ searchParams }: PageProps) {
  const canView = await canViewReports();
  if (!canView) redirect("/dashboard");

  const params = await searchParams;
  const today = getLocalDateString();
  const from = params.from ?? today;
  const to = params.to ?? today;

  const [summary, expenses, staffPayments, staffList] = await Promise.all([
    getFinancialSummary(from, to),
    getExpenses(from, to),
    getStaffPayments(from, to),
    getStaff(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finances</h1>
        <p className="text-muted-foreground">
          Complete money flow — sales, stock sold, advances, expenses, and net profit.
        </p>
      </div>
      <FinancesDashboard
        summary={summary}
        expenses={expenses}
        staffPayments={staffPayments}
        staffList={staffList.map((s) => ({ id: s.id, full_name: s.full_name }))}
        from={from}
        to={to}
      />
    </div>
  );
}
