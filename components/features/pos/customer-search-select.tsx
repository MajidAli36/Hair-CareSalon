"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCustomerName } from "@/lib/format";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
};

type CustomerSearchSelectProps = {
  customers: CustomerOption[];
  value: string;
  onChange: (customerId: string) => void;
  id?: string;
};

export function CustomerSearchSelect({
  customers,
  value,
  onChange,
  id = "customer",
}: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value) ?? null;
  const label = selected
    ? `${formatCustomerName(selected.first_name, selected.last_name)}${
        selected.phone ? ` (${selected.phone})` : ""
      }`
    : "Walk-in";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = formatCustomerName(c.first_name, c.last_name).toLowerCase();
      const phone = (c.phone ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [customers, query]);

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

  function pick(nextId: string) {
    onChange(nextId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        className="h-8 w-full justify-between px-2.5 font-normal"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or phone…"
                className="h-8 pl-8"
                aria-label="Search customers"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => pick("")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                !value && "bg-muted"
              )}
            >
              <Check
                className={cn("size-3.5 shrink-0", !value ? "opacity-100" : "opacity-0")}
              />
              <span className="font-medium">Walk-in</span>
              <span className="text-xs text-muted-foreground">No customer profile</span>
            </button>

            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No customers found.</p>
            ) : (
              filtered.map((c) => {
                const selectedRow = value === c.id;
                const name = formatCustomerName(c.first_name, c.last_name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={selectedRow}
                    onClick={() => pick(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      selectedRow && "bg-muted"
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        selectedRow ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    {c.phone ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
