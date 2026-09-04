import Link from "next/link";
import { formatCurrency } from "@/lib/format";

type LiveService = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

export function ServicesSection({ liveServices }: { liveServices?: LiveService[] }) {
  const items = (liveServices ?? []).map((s) => ({
    id: s.id,
    title: s.name,
    duration: `${s.duration_minutes} min`,
    from: formatCurrency(s.price),
  }));

  const count = items.length;

  return (
    <section id="services" className="scroll-mt-24 bg-[var(--m-paper)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--m-accent)]">
            Services
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--m-ink)] sm:text-5xl">
            Crafted for how you live
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[var(--m-muted)]">
            {count > 0
              ? `${count} service${count === 1 ? "" : "s"} from our live menu — priced and timed as in the salon.`
              : "Our service menu will appear here once the salon publishes offerings."}
          </p>
        </div>

        {count === 0 ? (
          <p className="mt-14 border-y border-[var(--m-line)] py-10 text-[var(--m-muted)]">
            No active services yet. Add them under Catalog → Services.
          </p>
        ) : (
          <ul className="mt-14 divide-y divide-[var(--m-line)] border-y border-[var(--m-line)]">
            {items.map((service) => (
              <li
                key={service.id}
                className="grid gap-3 py-8 sm:grid-cols-[1.4fr_auto] sm:items-baseline sm:gap-8"
              >
                <h3 className="font-display text-2xl font-medium text-[var(--m-ink)] sm:text-3xl">
                  {service.title}
                </h3>
                <div className="flex items-baseline gap-4 text-sm sm:justify-end">
                  <span className="text-[var(--m-muted)]">{service.duration}</span>
                  <span className="font-semibold text-[var(--m-ink)]">from {service.from}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10">
          <Link
            href="/book"
            className="inline-flex h-11 items-center border border-[var(--m-ink)] px-6 text-sm font-semibold tracking-wide text-[var(--m-ink)] transition-colors hover:bg-[var(--m-ink)] hover:text-[var(--m-paper)]"
          >
            Book a service
          </Link>
        </div>
      </div>
    </section>
  );
}
