import { TESTIMONIALS } from "@/lib/marketing/brand";
import { Quote } from "lucide-react";

export function TestimonialsSection() {
  return (
    <section className="border-y border-stone-200/80 bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Testimonials</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-stone-900">
            Loved by our clients
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="flex flex-col rounded-2xl border border-stone-200 bg-[#faf8f5] p-8"
            >
              <Quote className="size-8 text-amber-200" />
              <p className="mt-4 flex-1 text-base leading-relaxed text-stone-700">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-6 border-t border-stone-200 pt-4">
                <p className="font-medium text-stone-900">{t.name}</p>
                <p className="text-sm text-stone-500">{t.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
