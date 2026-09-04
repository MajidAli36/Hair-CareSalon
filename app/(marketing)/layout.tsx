import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { BRAND } from "@/lib/marketing/brand";
import { SYNCOPS } from "@/lib/print/syncops";
import { SITE_SEO } from "@/lib/seo/site";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-marketing-display",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-marketing-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline} · ${SYNCOPS.name}`,
    template: SITE_SEO.titleTemplate,
  },
  description: SITE_SEO.description,
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline} · ${SYNCOPS.name}`,
    description: SITE_SEO.description,
    siteName: `${BRAND.name} · ${SYNCOPS.name}`,
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} marketing-site flex min-h-full flex-col`}
    >
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
