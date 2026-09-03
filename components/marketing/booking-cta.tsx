import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/marketing/brand";
import { Button } from "@/components/ui/button";

export function BookingCta() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-stone-900 px-8 py-16 text-center sm:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(180,83,9,0.35),transparent_55%)]" />
          <div className="relative space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-500">Ready?</p>
            <h2 className="font-serif text-4xl font-semibold text-white sm:text-5xl">
              Book your appointment today
            </h2>
            <p className="mx-auto max-w-xl text-lg text-stone-400">
              Pick your stylist, choose a time, and walk in knowing your slot is reserved at{" "}
              {BRAND.name}.
            </p>
            <Button
              size="lg"
              className="mt-4 h-12 bg-amber-700 px-10 text-base text-white hover:bg-amber-600"
              render={<Link href="/book" />}
            >
              Book online now
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
