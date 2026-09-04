import Link from "next/link";
import { BRAND } from "@/lib/marketing/brand";
import { SyncOpsCredit } from "@/components/print/syncops-credit";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--m-ink)] text-[var(--m-accent-soft)]">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl font-semibold text-white">{BRAND.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            Precision hair care — cuts, color, and treatments with quiet attention to
            detail.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Explore</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>
              <Link href="/#services" className="hover:text-white">
                Services
              </Link>
            </li>
            <li>
              <Link href="/#salon" className="hover:text-white">
                The salon
              </Link>
            </li>
            <li>
              <Link href="/book" className="hover:text-white">
                Book online
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li>{BRAND.address}</li>
            <li>
              <a href={`tel:${BRAND.phoneMobile.replace(/\s/g, "")}`} className="hover:text-white">
                {BRAND.phoneMobile}
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.email}`} className="hover:text-white">
                {BRAND.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-white/40 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p>
              © {year} {BRAND.name}
            </p>
            <SyncOpsCredit variant="dark" />
          </div>
          <div className="flex gap-6">
            <a
              href={BRAND.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/70"
            >
              Instagram
            </a>
            <a
              href={BRAND.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/70"
            >
              Facebook
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
