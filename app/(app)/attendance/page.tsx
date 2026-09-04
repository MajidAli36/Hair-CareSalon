import { Suspense } from "react";
import { getAttendanceOverview, getAttendanceReport } from "@/lib/actions/attendance";
import { getStaff } from "@/lib/actions/staff";
import { canManageRecords } from "@/lib/auth/permissions";
import { AttendanceDashboard } from "@/components/features/attendance/attendance-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalDateString } from "@/lib/dates/local";

type AttendancePageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    staff?: string;
    view?: string;
  }>;
};

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const params = await searchParams;
  const today = getLocalDateString();
  const from = params.from ?? today;
  const to = params.to ?? today;
  const view = params.view ?? (from === to ? "daily" : "range");

  const [report, overview, staffList, canManage] = await Promise.all([
    getAttendanceReport(from, to, params.staff || undefined),
    getAttendanceOverview(),
    getStaff(),
    canManageRecords(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          Thumb impression at the entrance, or manual check-in when needed. Enroll staff, open the
          kiosk, and review hours here.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AttendanceDashboard
          report={report}
          overview={overview}
          staffList={staffList
            .filter((s) => s.is_active !== false)
            .map((s) => ({
              id: s.id,
              full_name: s.full_name,
              thumb_id: (s as { thumb_id?: string | null }).thumb_id ?? null,
              thumb_enrolled_at:
                (s as { thumb_enrolled_at?: string | null }).thumb_enrolled_at ?? null,
            }))}
          canManage={canManage}
          from={from}
          to={to}
          view={view}
        />
      </Suspense>
    </div>
  );
}
