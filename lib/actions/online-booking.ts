"use server";

import { getAppointments } from "@/lib/actions/appointments";

export type OnlineAppointmentRow = Awaited<
  ReturnType<typeof getAppointments>
>[number];

/** Client-callable fetch — updates list without full page navigation. */
export async function fetchOnlineAppointments(
  date: string
): Promise<OnlineAppointmentRow[]> {
  return getAppointments(date, { source: "ONLINE" });
}
