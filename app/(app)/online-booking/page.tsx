import {
  getAppointments,
  getBookingAdvanceSettings,
  getPendingDepositCount,
} from "@/lib/actions/appointments";
import { getOnlineBookingStaff, getStaffSchedulesForOrg } from "@/lib/actions/scheduling";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { OnlineBookingHub } from "@/components/features/online-booking/online-booking-hub";
import { getLocalDateString } from "@/lib/dates/local";

type PageProps = {
  searchParams: Promise<{ date?: string; focus?: string }>;
};

function isValidDateParam(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function OnlineBookingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialDate = isValidDateParam(params.date) ? params.date : getLocalDateString();
  const focus = params.focus === "deposits" ? "deposits" : null;

  const org = await requireOrganization();
  const supabase = await createClient();
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("slug, booking_days_ahead")
    .eq("id", org.organizationId)
    .single();

  const [appointments, staff, advanceSettings, pendingCount, schedules] = await Promise.all([
    getAppointments(initialDate, { source: "ONLINE" }).catch(() => []),
    getOnlineBookingStaff().catch(() => []),
    getBookingAdvanceSettings().catch(() => null),
    getPendingDepositCount().catch(() => 0),
    getStaffSchedulesForOrg().catch(() => []),
  ]);

  const publicUrl = `/book/${orgRow?.slug ?? "hair-salon"}`;

  return (
    <OnlineBookingHub
      key={`${initialDate}-${focus ?? "none"}`}
      initialDate={initialDate}
      initialAppointments={appointments}
      staff={staff}
      schedules={schedules}
      advanceSettings={advanceSettings}
      initialPendingCount={pendingCount}
      publicUrl={publicUrl}
      focus={focus}
    />
  );
}
