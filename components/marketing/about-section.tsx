import Image from "next/image";
import { BRAND } from "@/lib/marketing/brand";

const SALON_IMAGE =
  "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=2000&q=80";

export function AboutSection({ salonName }: { salonName?: string | null }) {
  const name = salonName?.trim() || BRAND.name;

  return (
    <section id="salon" className="scroll-mt-24">
      <div className="relative min-h-[70vh] overflow-hidden bg-[var(--m-ink)]">
        <Image
          src={SALON_IMAGE}
          alt="Calm salon interior"
          fill
          sizes="100vw"
          className="object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(12,31,28,0.82)_0%,rgba(12,31,28,0.45)_55%,rgba(12,31,28,0.2)_100%)]" />
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-end px-6 py-20 sm:py-24">
          <div className="max-w-lg text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--m-accent-soft)]">
              The salon
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              An unhurried room for better hair
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              At {name}, we listen first — then cut, color, and finish with materials chosen for
              lasting shine, not just the walk out.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
