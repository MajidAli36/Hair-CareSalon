import { Crown, Palette, Scissors, Sparkles } from "lucide-react";
import Link from "next/link";
import { FEATURED_SERVICES } from "@/lib/marketing/brand";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

const ICONS = {
  scissors: Scissors,
  palette: Palette,
  sparkles: Sparkles,
  crown: Crown,
} as const;

type LiveService = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

export function ServicesSection({ liveServices }: { liveServices?: LiveService[] }) {
  const items =
    liveServices && liveServices.length > 0
      ? liveServices.slice(0, 4).map((s) => ({
          title: s.name,
          description: `Professional ${s.name.toLowerCase()} with premium products and expert care.`,
          duration: `${s.duration_minutes} min`,
          from: formatCurrency(s.price),
          icon: "scissors" as const,
        }))
      : FEATURED_SERVICES;

  return (
    <section id="services" className="scroll-mt-24 border-t border-stone-200/80 bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Our services</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Crafted for every style
          </h2>
          <p className="mt-4 text-lg text-stone-600">
            From everyday cuts to special-occasion glam — every service is tailored to you.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((service) => {
            const Icon = ICONS[service.icon] ?? Scissors;
            return (
              <article
                key={service.title}
                className="group flex flex-col rounded-2xl border border-stone-200 bg-[#faf8f5] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-900/5"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800 transition-colors group-hover:bg-amber-800 group-hover:text-white">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 font-serif text-xl font-medium text-stone-900">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600">{service.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-4 text-sm">
                  <span className="text-stone-500">{service.duration}</span>
                  <span className="font-semibold text-amber-800">from {service.from}</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Button
            size="lg"
            className="bg-stone-900 hover:bg-amber-900"
            render={<Link href="/book" />}
          >
            Book a service
          </Button>
        </div>
      </div>
    </section>
  );
}
