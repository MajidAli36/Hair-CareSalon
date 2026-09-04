import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrgBySlug } from "@/lib/actions/appointments";
import { MarketingBookingPage } from "@/components/marketing/marketing-booking-page";
import { BRAND } from "@/lib/marketing/brand";
import { SYNCOPS } from "@/lib/print/syncops";

export const dynamic = "force-dynamic";

type BookPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  return {
    title: org ? `Book at ${BRAND.name}` : "Book appointment",
    description: org
      ? `Book online at ${BRAND.name}. Powered by ${SYNCOPS.name} · ${SYNCOPS.domain}`
      : `Online salon booking by ${SYNCOPS.name}`,
  };
}

export default async function BookSlugPage({ params }: BookPageProps) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  return <MarketingBookingPage org={org} />;
}
