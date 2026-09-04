import Link from "next/link";
import { OnlineBookingForm } from "@/components/features/booking/online-booking-form";
import { BRAND } from "@/lib/marketing/brand";

type Org = {
  slug: string;
  name: string;
  services: { id: string; name: string; price: number; duration_minutes: number }[];
  staff: { id: string; full_name: string; job_title: string | null }[];
  booking_days_ahead?: number | null;
  booking_advance_amount?: number | null;
  booking_advance_percent?: number | null;
  booking_payment_instructions?: string | null;
} | null;

export function MarketingBookingPage({ org }: { org: Org }) {
  return (
    <div className="bg-[var(--m-paper)] pt-20 sm:pt-24">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--m-accent)]">
            Online booking
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--m-ink)] sm:text-5xl">
            Book your appointment
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--m-muted)]">
            Choose services, stylist, and time — your chair is held the moment you confirm.
          </p>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-5 lg:items-start">
          <aside className="space-y-8 lg:col-span-2">
            <div className="border-t border-[var(--m-line)] pt-6">
              <p className="font-display text-2xl font-medium text-[var(--m-ink)]">{BRAND.name}</p>
              <p className="mt-1 text-sm text-[var(--m-muted)]">{BRAND.tagline}</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--m-muted)]">
                    Address
                  </dt>
                  <dd className="mt-1 text-[var(--m-ink)]">{BRAND.address}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--m-muted)]">
                    Phone
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={`tel:${BRAND.phoneMobile.replace(/\s/g, "")}`}
                      className="text-[var(--m-ink)] underline-offset-4 hover:underline"
                    >
                      {BRAND.phoneMobile}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--m-muted)]">
                    Hours
                  </dt>
                  <dd className="mt-1 space-y-1 text-[var(--m-ink)]">
                    {BRAND.hours.map((h) => (
                      <div key={h.days} className="flex justify-between gap-4">
                        <span className="text-[var(--m-muted)]">{h.days}</span>
                        <span>{h.time}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-[var(--m-line)] pt-6 text-sm text-[var(--m-muted)]">
              <p className="font-medium text-[var(--m-ink)]">Before you arrive</p>
              <ul className="mt-3 space-y-2">
                <li>Arrive five minutes early</li>
                <li>Bring inspiration photos if you have them</li>
                <li>Please call 24 hours ahead to cancel</li>
              </ul>
            </div>
          </aside>

          <div className="lg:col-span-3">
            {org ? (
              <OnlineBookingForm
                variant="marketing"
                orgSlug={org.slug}
                orgName={BRAND.name}
                services={org.services}
                staff={org.staff}
                daysAhead={org.booking_days_ahead ?? 30}
                advanceSettings={{
                  booking_advance_amount: org.booking_advance_amount,
                  booking_advance_percent: org.booking_advance_percent,
                  booking_payment_instructions: org.booking_payment_instructions,
                }}
              />
            ) : (
              <div className="border border-dashed border-[var(--m-line)] bg-[var(--m-mist)] p-10 text-center">
                <p className="font-medium text-[var(--m-ink)]">
                  Online booking is temporarily unavailable
                </p>
                <p className="mt-2 text-sm text-[var(--m-muted)]">
                  Please call{" "}
                  <a
                    href={`tel:${BRAND.phoneMobile.replace(/\s/g, "")}`}
                    className="underline underline-offset-4"
                  >
                    {BRAND.phoneMobile}
                  </a>{" "}
                  to schedule.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-block text-sm font-medium text-[var(--m-accent)] hover:underline"
                >
                  ← Back to home
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
