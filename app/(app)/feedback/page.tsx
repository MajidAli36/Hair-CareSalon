import { redirect } from "next/navigation";
import { canUseFeedback } from "@/lib/auth/permissions";
import { getCustomers } from "@/lib/actions/customers";
import { getStaff } from "@/lib/actions/staff";
import { getFeedbackDashboard } from "@/lib/actions/feedback";
import { FeedbackHub } from "@/components/features/feedback/feedback-hub";
import {
  FEEDBACK_DIMENSIONS,
  type FeedbackDimensionKey,
} from "@/lib/feedback/dimensions";
import { getLocalDateString, startOfLocalMonth } from "@/lib/dates/local";

type FeedbackPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function emptyDashboard(from: string, to: string) {
  return {
    from,
    to,
    totalResponses: 0,
    overallAverage: 0,
    overallExperienceAverage: 0,
    dimensionAverages: FEEDBACK_DIMENSIONS.map((d) => ({
      key: d.key as FeedbackDimensionKey,
      label: d.label,
      average: 0,
      needsImprovement: false,
    })),
    needsImprovement: [],
    recent: [],
    lowScores: [],
  };
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const canAccess = await canUseFeedback();
  if (!canAccess) redirect("/dashboard");

  const params = await searchParams;
  const to = params.to ?? getLocalDateString();
  const from = params.from ?? startOfLocalMonth(to);

  const [customers, staffList, dashboard] = await Promise.all([
    getCustomers().catch(() => []),
    getStaff().catch(() => []),
    getFeedbackDashboard(from, to).catch(() => emptyDashboard(from, to)),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">
          Collect visit ratings from customers, then see where the salon needs improvement.
        </p>
      </div>

      <FeedbackHub
        customers={customers.map((c) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone,
        }))}
        staff={staffList
          .filter((s) => s.is_active !== false)
          .map((s) => ({ id: s.id, full_name: s.full_name }))}
        dashboard={dashboard}
      />
    </div>
  );
}
