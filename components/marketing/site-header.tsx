"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@/lib/marketing/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/#services" },
  { label: "About", href: "/#about" },
  { label: "Book", href: "/book" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#faf8f5]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex flex-col">
          <span className="font-serif text-2xl font-semibold tracking-tight text-stone-900 transition-colors group-hover:text-amber-800">
            {BRAND.name}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-stone-500">
            Salon &amp; Spa
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-amber-800",
                pathname === item.href || (item.href === "/book" && pathname.startsWith("/book"))
                  ? "text-amber-800"
                  : "text-stone-600"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            className="text-stone-600 hover:text-amber-800"
            render={<Link href="/login" />}
          >
            Staff
          </Button>
          <Button
            className="bg-stone-900 text-white shadow-lg shadow-stone-900/10 hover:bg-amber-900"
            render={<Link href="/book" />}
          >
            Book appointment
          </Button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-stone-700 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-stone-200 bg-[#faf8f5] px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-stone-700"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-stone-500">
              Staff login
            </Link>
            <Button className="mt-2 w-full bg-stone-900" render={<Link href="/book" onClick={() => setOpen(false)} />}>
              Book appointment
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
