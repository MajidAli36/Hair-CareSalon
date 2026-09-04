import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/book", "/login"],
        disallow: [
          "/syncops",
          "/dashboard",
          "/api/",
          "/pos",
          "/sales",
          "/customers",
          "/appointments",
          "/staff",
          "/attendance",
          "/devices",
          "/reports",
          "/finances",
          "/settings",
          "/whatsapp",
          "/queue",
          "/products",
          "/services",
          "/chairs",
          "/online-booking",
          "/kiosk/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
