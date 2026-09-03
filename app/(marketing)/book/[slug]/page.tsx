import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrgBySlug } from "@/lib/actions/appointments";
import { MarketingBookingPage } from "@/components/marketing/marketing-booking-page";
import { BRAND } from "@/lib/marketing/brand";

export const dynamic = "force-dynamic";

type BookPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  return {
    title: org ? `Book at ${BRAND.name}` : "Book appointment",
  };
}

export default async function BookSlugPage({ params }: BookPageProps) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  return <MarketingBookingPage org={org} />;
}
