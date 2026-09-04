import Image from "next/image";
import Link from "next/link";
import { SYNCOPS_PAGE } from "@/lib/marketing/syncops-page";

export default function SyncOpsStudioPage() {
  const { ceo } = SYNCOPS_PAGE;

  return (
    <div className="relative flex min-h-[100svh] flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <p className="font-display text-xl font-semibold tracking-tight text-[var(--s-mist)]">
          {SYNCOPS_PAGE.company}
        </p>
        <Link
          href="/"
          className="text-sm text-[var(--s-muted)] transition-colors hover:text-[var(--s-accent)]"
        >
          ← Salon home
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-6 py-10 sm:py-16">
        <div className="grid w-full items-center gap-10 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
          <div className="relative mx-auto w-full max-w-sm md:mx-0">
            <div className="overflow-hidden rounded-2xl border border-[var(--s-line)] bg-[var(--s-panel)]">
              <Image
                src={ceo.photo}
                alt={ceo.portraitAlt}
                width={640}
                height={800}
                priority
                className="aspect-[4/5] w-full object-cover object-top"
              />
            </div>
          </div>

          <div>
            <p className="s-fade-up text-xs font-semibold uppercase tracking-[0.28em] text-[var(--s-accent)]">
              {ceo.messageTitle}
            </p>
            <h1 className="s-fade-up s-fade-up-delay-1 mt-4 font-display text-3xl font-semibold tracking-tight text-[var(--s-mist)] sm:text-4xl">
              {ceo.name}
            </h1>
            <p className="s-fade-up s-fade-up-delay-1 mt-2 text-sm text-[var(--s-accent)]">
              {ceo.role}
            </p>
            <p className="s-fade-up s-fade-up-delay-2 mt-8 max-w-lg text-base leading-relaxed text-[var(--s-muted)] sm:text-lg">
              {ceo.message}
            </p>
            <div className="s-fade-up s-fade-up-delay-3 mt-10 flex flex-wrap gap-3">
              <a
                href={SYNCOPS_PAGE.url}
                target="_blank"
                rel="noopener noreferrer me author"
                className="inline-flex h-11 items-center bg-[var(--s-accent)] px-6 text-sm font-semibold text-[var(--s-ink)] transition-colors hover:bg-[var(--s-mist)]"
              >
                {SYNCOPS_PAGE.domain}
              </a>
              <a
                href={`mailto:${SYNCOPS_PAGE.email}`}
                className="inline-flex h-11 items-center border border-[var(--s-line)] px-6 text-sm text-[var(--s-mist)] transition-colors hover:border-[var(--s-accent)]"
              >
                {SYNCOPS_PAGE.email}
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--s-line)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-6 text-xs text-[var(--s-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SYNCOPS_PAGE.company}
          </p>
          <a
            href={`tel:${SYNCOPS_PAGE.phone.replace(/\s/g, "")}`}
            className="hover:text-[var(--s-accent)]"
          >
            {SYNCOPS_PAGE.phoneDisplay}
          </a>
        </div>
      </footer>
    </div>
  );
}
