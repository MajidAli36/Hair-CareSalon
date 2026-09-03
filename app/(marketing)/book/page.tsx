import type { Metadata } from "next";
import { getOrgBySlug } from "@/lib/actions/appointments";
import { MarketingBookingPage } from "@/components/marketing/marketing-booking-page";
import { BRAND, BOOKING_SLUG } from "@/lib/marketing/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: `Schedule your visit at ${BRAND.name}. Choose your stylist, services, and preferred time slot online.`,
};

export default async function BookAppointmentPage() {
  const org = await getOrgBySlug(BOOKING_SLUG);

  return <MarketingBookingPage org={org} />;
}
