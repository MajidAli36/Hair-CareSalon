import { buildSiteJsonLd } from "@/lib/seo/site";

/** Emits Salon + SyncOps JSON-LD so search engines always attribute syncops.tech */
export function SiteJsonLd() {
  const jsonLd = buildSiteJsonLd();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
