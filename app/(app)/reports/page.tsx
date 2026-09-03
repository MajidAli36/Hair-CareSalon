import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getReportsForRange } from "@/lib/actions/reports";
import { canViewReports } from "@/lib/auth/permissions";
import { ReportsDashboard } from "@/components/features/reports/reports-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalDateString } from "@/lib/dates/local";

type ReportsPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const canView = await canViewReports();
  if (!canView) redirect("/dashboard");

  const params = await searchParams;
  const today = getLocalDateString();
  const monthStart = new Date();
  monthStart.setDate(1);
  const defaultFrom = getLocalDateString(monthStart);

  const from = params.from ?? defaultFrom;
  const to = params.to ?? today;

  const report = await getReportsForRange(from, to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Revenue, inventory product sales, and profit — daily, weekly, or custom date range.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportsDashboard report={report} from={from} to={to} />
      </Suspense>
    </div>
  );
}
