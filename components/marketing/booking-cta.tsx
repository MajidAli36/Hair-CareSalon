import Link from "next/link";
import { BRAND } from "@/lib/marketing/brand";

type BookingCtaProps = {
  salonName?: string | null;
  stylistCount?: number;
  serviceCount?: number;
};

export function BookingCta({
  salonName,
  stylistCount = 0,
  serviceCount = 0,
}: BookingCtaProps) {
  const name = salonName?.trim() || BRAND.name;
  const availability =
    stylistCount > 0
      ? `${stylistCount} stylist${stylistCount === 1 ? "" : "s"} open for online booking`
      : "Call us to reserve a chair";

  return (
    <section id="visit" className="scroll-mt-24 bg-[var(--m-mist)] py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--m-accent)]">
            Visit
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--m-ink)] sm:text-5xl">
            Reserve your chair
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--m-muted)]">
            Book at {name}
            {serviceCount > 0 ? ` · ${serviceCount} services` : ""}. {availability}.
          </p>
          <Link
            href="/book"
            className="mt-8 inline-flex h-12 items-center bg-[var(--m-ink)] px-8 text-sm font-semibold tracking-wide text-[var(--m-paper)] transition-colors hover:bg-[var(--m-ink-soft)]"
          >
            Book online
          </Link>
        </div>

        <div className="space-y-6 border-t border-[var(--m-line)] pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--m-muted)]">
              Address
            </p>
            <p className="mt-2 text-base leading-relaxed text-[var(--m-ink)]">{BRAND.address}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--m-muted)]">
              Hours
            </p>
            <ul className="mt-2 space-y-1 text-base text-[var(--m-ink)]">
              {BRAND.hours.map((h) => (
                <li key={h.days} className="flex justify-between gap-6">
                  <span className="text-[var(--m-muted)]">{h.days}</span>
                  <span>{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--m-muted)]">
              Call
            </p>
            <a
              href={`tel:${BRAND.phoneMobile.replace(/\s/g, "")}`}
              className="mt-2 inline-block text-base text-[var(--m-ink)] underline-offset-4 hover:underline"
            >
              {BRAND.phoneMobile}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
