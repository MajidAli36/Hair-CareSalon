import { getOrgBySlug } from "@/lib/actions/appointments";
import { AboutSection } from "@/components/marketing/about-section";
import { BookingCta } from "@/components/marketing/booking-cta";
import { LandingHero } from "@/components/marketing/landing-hero";
import { ServicesSection } from "@/components/marketing/services-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import { BOOKING_SLUG } from "@/lib/marketing/brand";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const org = await getOrgBySlug(BOOKING_SLUG);

  return (
    <>
      <LandingHero />
      <ServicesSection liveServices={org?.services} />
      <AboutSection />
      <TestimonialsSection />
      <BookingCta />
    </>
  );
}
