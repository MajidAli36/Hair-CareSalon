import Link from "next/link";
import { Clock, MapPin, Phone, Sparkles } from "lucide-react";
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
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(180,83,9,0.08),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Online booking</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Book your appointment
          </h1>
          <p className="mt-4 text-lg text-stone-600">
            Fill in your details, pick a stylist and time — your slot is confirmed instantly.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-5 lg:items-start">
          <aside className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="font-serif text-lg font-medium text-stone-900">{BRAND.name}</p>
                  <p className="text-sm text-stone-500">{BRAND.tagline}</p>
                </div>
              </div>

              <ul className="mt-6 space-y-4 text-sm text-stone-600">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  {BRAND.address}
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-amber-700" />
                  <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="hover:text-amber-800">
                    {BRAND.phone}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <div>
                    {BRAND.hours.map((h) => (
                      <div key={h.days} className="flex justify-between gap-4">
                        <span>{h.days}</span>
                        <span className="text-stone-800">{h.time}</span>
                      </div>
                    ))}
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-6 text-sm text-stone-600">
              <p className="font-medium text-stone-800">What to expect</p>
              <ul className="mt-3 list-inside list-disc space-y-1.5">
                <li>Arrive 5 minutes early</li>
                <li>Bring inspiration photos if you have them</li>
                <li>Cancellations — please call us 24h ahead</li>
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
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
                <p className="font-medium text-stone-800">Online booking is temporarily unavailable</p>
                <p className="mt-2 text-sm text-stone-500">
                  Please call us at{" "}
                  <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="text-amber-800 underline">
                    {BRAND.phone}
                  </a>{" "}
                  to schedule your visit.
                </p>
                <Link href="/" className="mt-6 inline-block text-sm font-medium text-amber-800 hover:underline">
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
