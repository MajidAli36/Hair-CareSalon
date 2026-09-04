"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/marketing/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Services", href: "/#services" },
  { label: "The salon", href: "/#salon" },
  { label: "Visit", href: "/#visit" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = !isHome || scrolled || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        solid
          ? "border-b border-[var(--m-line)] bg-[var(--m-paper)]/92 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:h-20">
        <Link
          href="/"
          className={cn(
            "font-display text-xl font-semibold tracking-tight transition-colors sm:text-2xl",
            solid ? "text-[var(--m-ink)]" : "text-white"
          )}
        >
          {BRAND.name}
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium tracking-wide transition-opacity hover:opacity-70",
                solid ? "text-[var(--m-ink-soft)]" : "text-white/90"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/login"
            className={cn(
              "text-sm font-medium transition-opacity hover:opacity-70",
              solid ? "text-[var(--m-muted)]" : "text-white/75"
            )}
          >
            Login
          </Link>
          <Link
            href="/book"
            className={cn(
              "inline-flex h-10 items-center px-5 text-sm font-semibold tracking-wide transition-colors",
              solid
                ? "bg-[var(--m-ink)] text-[var(--m-paper)] hover:bg-[var(--m-ink-soft)]"
                : "bg-white text-[var(--m-ink)] hover:bg-white/90"
            )}
          >
            Booking
          </Link>
        </div>

        <button
          type="button"
          className={cn("p-2 md:hidden", solid ? "text-[var(--m-ink)]" : "text-white")}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--m-line)] bg-[var(--m-paper)] px-6 py-5 md:hidden">
          <nav className="flex flex-col gap-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-[var(--m-ink)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-sm text-[var(--m-muted)]"
            >
              Login
            </Link>
            <Link
              href="/book"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center bg-[var(--m-ink)] text-sm font-semibold text-[var(--m-paper)]"
            >
              Booking
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
