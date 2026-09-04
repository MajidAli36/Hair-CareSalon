import type { Metadata } from "next";
import { BRAND } from "@/lib/marketing/brand";
import { SYNCOPS } from "@/lib/print/syncops";

/** Public site origin for absolute SEO URLs (OG, sitemap, canonical). */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return SYNCOPS.url;
}

export const SITE_SEO = {
  salonName: BRAND.name,
  tagline: BRAND.tagline,
  /** Always include SyncOps in browser / SERP titles */
  titleDefault: `${BRAND.name} | ${SYNCOPS.name}`,
  titleTemplate: `%s | ${BRAND.name} · ${SYNCOPS.name}`,
  description: `${BRAND.name} — ${BRAND.tagline}. Expert stylists, online booking, and salon management powered by ${SYNCOPS.name} (${SYNCOPS.domain}).`,
  keywords: [
    BRAND.name,
    "salon",
    "hair care",
    "online booking",
    "Gujranwala salon",
    SYNCOPS.name,
    SYNCOPS.domain,
    "SyncOps salon software",
    "POS",
  ],
  creator: SYNCOPS.name,
  publisher: SYNCOPS.name,
  authorUrl: SYNCOPS.url,
} as const;

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: SITE_SEO.titleDefault,
      template: SITE_SEO.titleTemplate,
    },
    description: SITE_SEO.description,
    applicationName: `${BRAND.name} · ${SYNCOPS.name}`,
    authors: [{ name: SYNCOPS.name, url: SYNCOPS.url }],
    creator: SYNCOPS.name,
    publisher: SYNCOPS.name,
    keywords: [...SITE_SEO.keywords],
    category: "business",
    referrer: "origin-when-cross-origin",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "en_PK",
      url: siteUrl,
      siteName: `${BRAND.name} · ${SYNCOPS.name}`,
      title: SITE_SEO.titleDefault,
      description: SITE_SEO.description,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_SEO.titleDefault,
      description: SITE_SEO.description,
      creator: `@${SYNCOPS.name}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    other: {
      "application-name": `${BRAND.name} · ${SYNCOPS.name}`,
      "msapplication-TileColor": "#0f172a",
      "theme-color": "#0f172a",
      "copyright": `${BRAND.name}. Platform by ${SYNCOPS.name} (${SYNCOPS.domain})`,
    },
  };
}

/** JSON-LD for salon site + SyncOps as software creator (always linked). */
export function buildSiteJsonLd(siteUrl = getSiteUrl()) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: BRAND.name,
        description: SITE_SEO.description,
        publisher: { "@id": `${siteUrl}/#salon` },
        creator: { "@id": `${SYNCOPS.url}/#organization` },
        inLanguage: "en-PK",
      },
      {
        "@type": "HairSalon",
        "@id": `${siteUrl}/#salon`,
        name: BRAND.name,
        description: `${BRAND.name} — ${BRAND.tagline}`,
        url: siteUrl,
        telephone: BRAND.phoneMobile,
        email: BRAND.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: BRAND.address,
          addressLocality: "Gujranwala",
          addressCountry: "PK",
        },
        sameAs: [BRAND.social.instagram, BRAND.social.facebook].filter(
          (u) => u && !u.endsWith("instagram.com") && !u.endsWith("facebook.com")
        ),
      },
      {
        "@type": "Organization",
        "@id": `${SYNCOPS.url}/#organization`,
        name: SYNCOPS.name,
        legalName: SYNCOPS.name,
        url: SYNCOPS.url,
        email: SYNCOPS.email,
        telephone: SYNCOPS.phone,
        sameAs: [SYNCOPS.url],
        description: SYNCOPS.seoDescription,
      },
      {
        "@type": "SoftwareApplication",
        name: `${SYNCOPS.name} Salon Platform`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SYNCOPS.url,
        author: { "@id": `${SYNCOPS.url}/#organization` },
        provider: { "@id": `${SYNCOPS.url}/#organization` },
        offers: {
          "@type": "Offer",
          url: SYNCOPS.url,
          priceCurrency: "PKR",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  };
}
