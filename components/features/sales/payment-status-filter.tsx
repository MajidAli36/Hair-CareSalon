"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SalePaymentStatus } from "@/types/commerce";

const PAYMENT_STATUS_OPTIONS: { value: "" | SalePaymentStatus; label: string }[] = [
  { value: "", label: "All payment statuses" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
  { value: "REFUNDED", label: "Refunded" },
];

export function PaymentStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const current = (searchParams.get("payment_status") ?? "") as "" | SalePaymentStatus;
  const selected =
    PAYMENT_STATUS_OPTIONS.find((o) => o.value === current) ?? PAYMENT_STATUS_OPTIONS[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAYMENT_STATUS_OPTIONS;
    return PAYMENT_STATUS_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(value: "" | SalePaymentStatus) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("payment_status", value);
    else params.delete("payment_status");
    setOpen(false);
    setQuery("");
    startTransition(() => {
      router.replace(`/sales?${params.toString()}`);
    });
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>
      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search status…"
              className="h-8 pl-8"
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-auto py-0.5">
            {filtered.map((opt) => (
              <li key={opt.value || "all"}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    opt.value === current && "bg-muted"
                  )}
                  onClick={() => pick(opt.value)}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      opt.value === current ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">No match</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
