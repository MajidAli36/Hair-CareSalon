import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { SYNCOPS } from "@/lib/print/syncops";
import { SYNCOPS_PAGE } from "@/lib/marketing/syncops-page";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-studio-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-studio-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${SYNCOPS.name} · Studio`,
  description: SYNCOPS.seoDescription,
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: {
    canonical: SYNCOPS_PAGE.path,
  },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} syncops-studio min-h-full antialiased`}
    >
      {children}
    </div>
  );
}
