import { CheckCircle2 } from "lucide-react";
import { BRAND } from "@/lib/marketing/brand";

const POINTS = [
  "Expert stylists trained in the latest techniques",
  "Premium, salon-grade products only",
  "Hygienic, calm, and welcoming environment",
  "Real-time online booking — no phone tag",
  "Personalized consultation every visit",
];

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-2">
        <div className="relative">
          <div className="aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-stone-100 to-stone-200 shadow-xl">
            <div className="flex h-full items-center justify-center p-12">
              <div className="text-center">
                <p className="font-serif text-6xl font-semibold text-amber-800/30">{BRAND.name}</p>
                <p className="mt-2 text-sm uppercase tracking-[0.3em] text-stone-500">Est. 2014</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-4 top-8 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-lg">
            <p className="text-2xl font-semibold text-stone-900">5,000+</p>
            <p className="text-xs text-stone-500">Happy clients</p>
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">About us</p>
          <h2 className="font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            More than a salon — a care experience
          </h2>
          <p className="text-lg leading-relaxed text-stone-600">
            At {BRAND.name}, we believe great hair starts with listening. Our team takes time to
            understand your goals, recommend the right treatments, and deliver results that feel
            effortlessly you.
          </p>
          <ul className="space-y-3 pt-2">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-stone-700">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
