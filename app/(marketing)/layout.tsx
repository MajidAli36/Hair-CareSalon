import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { BRAND } from "@/lib/marketing/brand";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — Premium Salon & Hair Care`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Book your appointment at Hair & Care Salon — expert stylists, premium treatments, and a luxurious salon experience in Gujranwala.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfair.variable} marketing-site flex min-h-full flex-col bg-[#faf8f5] font-sans text-stone-900`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
