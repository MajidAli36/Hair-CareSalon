import Link from "next/link";
import { ArrowRight, Calendar, Sparkles, Star } from "lucide-react";
import { BRAND } from "@/lib/marketing/brand";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(180,83,9,0.12),transparent)]" />
      <div className="absolute -right-32 top-20 size-96 rounded-full bg-amber-100/40 blur-3xl" />
      <div className="absolute -left-20 bottom-0 size-72 rounded-full bg-stone-200/50 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/80 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-amber-800 shadow-sm backdrop-blur">
            <Sparkles className="size-3.5" />
            Premium salon experience
          </div>

          <div className="space-y-4">
            <h1 className="font-serif text-5xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-6xl lg:text-7xl">
              Your hair,
              <span className="block text-amber-800">beautifully cared for</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-stone-600">
              {BRAND.name} brings together expert stylists, premium products, and a calm,
              luxurious space — so you leave feeling confident and refreshed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className="h-12 bg-stone-900 px-8 text-base shadow-xl shadow-stone-900/15 hover:bg-amber-900"
              render={<Link href="/book" />}
            >
              Book your visit
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-stone-300 bg-white/60 px-8 text-base text-stone-700 hover:bg-white"
              render={<Link href="/#services" />}
            >
              View services
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-stone-600">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-500 text-amber-500" />
              ))}
              <span className="ml-2 font-medium text-stone-800">4.9</span>
              <span className="text-stone-500">(200+ reviews)</span>
            </div>
            <span className="hidden h-4 w-px bg-stone-300 sm:block" />
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-amber-700" />
              Same-day slots available
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/5] overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-br from-stone-200 via-amber-50 to-amber-100 shadow-2xl shadow-stone-900/10">
            <div className="flex h-full flex-col justify-end p-8">
              <div className="rounded-2xl border border-white/60 bg-white/80 p-6 backdrop-blur-md">
                <p className="font-serif text-xl font-medium text-stone-900">
                  &ldquo;Transform your look with our signature treatments&rdquo;
                </p>
                <p className="mt-2 text-sm text-stone-600">Hair · Color · Care · Style</p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
            <p className="text-3xl font-semibold text-amber-800">10+</p>
            <p className="text-sm text-stone-600">Years of excellence</p>
          </div>
        </div>
      </div>
    </section>
  );
}
