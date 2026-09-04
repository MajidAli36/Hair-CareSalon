import { SYNCOPS } from "@/lib/print/syncops";

/** Content for the unlisted /syncops CEO page. */
export const SYNCOPS_PAGE = {
  path: "/syncops",
  company: SYNCOPS.name,
  domain: SYNCOPS.domain,
  url: SYNCOPS.url,
  email: "info@syncops.tech",
  phone: SYNCOPS.phone,
  phoneDisplay: SYNCOPS.phoneDisplay,
  ceo: {
    name: "Majid Ali",
    role: "Founder & Chief Executive Officer",
    photo: "/syncops/ceo-majid-ali.png",
    portraitAlt: "Majid Ali, Founder & CEO of SyncOps",
    messageTitle: "Message from the CEO",
    message:
      "We don't just build software—we build partnerships that drive lasting success. SyncOps creates long-term products and systems for global markets, with quality, discipline, and trust at the center of every engagement.",
  },
} as const;
