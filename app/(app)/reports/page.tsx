import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canViewReports } from "@/lib/auth/permissions";
import { ReportCenter } from "@/components/features/reports/report-center";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalDateString } from "@/lib/dates/local";
import { isReportTabId, type ReportTabId } from "@/lib/reports/range";

type ReportsPageProps = {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
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
  const tab: ReportTabId = isReportTabId(params.tab) ? params.tab : "overall";

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportCenter initialFrom={from} initialTo={to} initialTab={tab} />
    </Suspense>
  );
}
