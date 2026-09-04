import { getOrgBySlug } from "@/lib/actions/appointments";
import { AboutSection } from "@/components/marketing/about-section";
import { BookingCta } from "@/components/marketing/booking-cta";
import { LandingHero } from "@/components/marketing/landing-hero";
import { ServicesSection } from "@/components/marketing/services-section";
import { BOOKING_SLUG, BRAND } from "@/lib/marketing/brand";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const org = await getOrgBySlug(BOOKING_SLUG);
  const services = org?.services ?? [];
  const staff = org?.staff ?? [];

  return (
    <>
      <LandingHero salonName={org?.name ?? BRAND.name} />
      <ServicesSection liveServices={services} />
      <AboutSection salonName={org?.name ?? BRAND.name} />
      <BookingCta
        salonName={org?.name ?? BRAND.name}
        stylistCount={staff.length}
        serviceCount={services.length}
      />
    </>
  );
}
