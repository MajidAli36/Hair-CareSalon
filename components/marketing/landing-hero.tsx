import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/marketing/brand";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=2400&q=80";

export function LandingHero({ salonName }: { salonName?: string | null }) {
  const name = salonName?.trim() || BRAND.name;

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[var(--m-ink)] text-white">
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt="Stylist at work in the salon"
          fill
          priority
          sizes="100vw"
          className="m-ken object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(12,31,28,0.88)_0%,rgba(12,31,28,0.55)_42%,rgba(12,31,28,0.28)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,31,28,0.55)_0%,transparent_42%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 sm:pb-20 lg:justify-center lg:pb-24 lg:pt-32">
        <div className="max-w-2xl">
          <p className="m-fade-up font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
            {name}
          </p>
          <div className="m-rule mt-6 h-px w-24 bg-[var(--m-accent-soft)]" />
          <h1 className="m-fade-up m-fade-up-delay-1 mt-6 font-display text-2xl font-medium leading-snug text-white/95 sm:text-3xl lg:text-4xl">
            Precision cuts. Considered color. Quiet luxury.
          </h1>
          <p className="m-fade-up m-fade-up-delay-2 mt-4 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
            A calm atelier for hair that looks intentional — every day you wear it.
          </p>
          <div className="m-fade-up m-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href="/book"
              className="inline-flex h-12 items-center bg-white px-7 text-sm font-semibold tracking-wide text-[var(--m-ink)] transition-colors hover:bg-[var(--m-mist)]"
            >
              Book your visit
            </Link>
            <Link
              href="/#services"
              className="inline-flex h-12 items-center border border-white/35 px-7 text-sm font-medium tracking-wide text-white transition-colors hover:border-white hover:bg-white/10"
            >
              Explore services
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
