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

export default async function OnlineBookingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialDate = params.date ?? getLocalDateString();
  const focus = params.focus === "deposits" ? "deposits" : null;
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("slug, booking_days_ahead")
    .eq("id", org.organizationId)
    .single();

  const [appointments, staff, advanceSettings, pendingCount, schedules] = await Promise.all([
    getAppointments(initialDate, { source: "ONLINE" }),
    getOnlineBookingStaff(),
    getBookingAdvanceSettings(),
    getPendingDepositCount(),
    getStaffSchedulesForOrg(),
  ]);

  const publicUrl = `/book/${orgRow?.slug ?? "hair-salon"}`;

  return (
    <OnlineBookingHub
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
