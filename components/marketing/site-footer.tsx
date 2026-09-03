import Link from "next/link";
import { Globe, Mail, MapPin, Phone, Share2 } from "lucide-react";
import { BRAND } from "@/lib/marketing/brand";
import { SyncOpsCredit } from "@/components/print/syncops-credit";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-stone-200 bg-stone-900 text-stone-300">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-serif text-2xl font-semibold text-white">{BRAND.name}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-400">
            {BRAND.tagline}. Premium hair care, color, and styling in the heart of Lahore.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href={BRAND.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-10 items-center justify-center rounded-full border border-stone-700 text-stone-400 transition-colors hover:border-amber-700 hover:text-amber-500"
              aria-label="Instagram"
            >
              <Share2 className="size-4" />
            </a>
            <a
              href={BRAND.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-10 items-center justify-center rounded-full border border-stone-700 text-stone-400 transition-colors hover:border-amber-700 hover:text-amber-500"
              aria-label="Facebook"
            >
              <Globe className="size-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Hours</p>
          <ul className="mt-4 space-y-2 text-sm">
            {BRAND.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span className="text-stone-400">{h.days}</span>
                <span className="text-stone-200">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Contact</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>{BRAND.address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-amber-600" />
              <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="hover:text-white">
                {BRAND.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-amber-600" />
              <a href={`mailto:${BRAND.email}`} className="hover:text-white">
                {BRAND.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-stone-500 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p>© {year} {BRAND.name}. All rights reserved.</p>
            <SyncOpsCredit variant="dark" />
          </div>
          <div className="flex gap-6">
            <Link href="/book" className="hover:text-stone-300">
              Book online
            </Link>
            <Link href="/login" className="hover:text-stone-300">
              Staff portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
