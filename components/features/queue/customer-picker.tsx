"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCustomerName } from "@/lib/format";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomerOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
};

type CustomerPickerProps = {
  customers: CustomerOption[];
  name?: string;
  required?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
};

export function CustomerPicker({
  customers,
  name = "customer_id",
  required = false,
  id,
  placeholder = "Search name or phone…",
  className,
}: CustomerPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        const full = formatCustomerName(c.first_name, c.last_name).toLowerCase();
        const phone = (c.phone ?? "").toLowerCase();
        return full.includes(q) || phone.includes(q);
      })
      .slice(0, 8);
  }, [customers, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectCustomer(c: CustomerOption) {
    setSelectedId(c.id);
    setQuery(formatCustomerName(c.first_name, c.last_name) + (c.phone ? ` · ${c.phone}` : ""));
    setOpen(false);
  }

  function clearSelection() {
    setSelectedId("");
    setQuery("");
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && filtered[highlight]) {
      e.preventDefault();
      selectCustomer(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          className="h-9 pl-8 pr-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            if (selectedId) setSelectedId("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {(query || selectedId) && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={clearSelection}
            aria-label="Clear customer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-muted-foreground">No customers found</li>
          ) : (
            filtered.map((c, i) => {
              const label = formatCustomerName(c.first_name, c.last_name);
              return (
                <li key={c.id} role="option" aria-selected={selectedId === c.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-accent",
                      i === highlight && "bg-accent"
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="font-medium">{label}</span>
                    {c.phone && (
                      <span className="text-xs text-muted-foreground">{c.phone}</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {required && !selectedId && query.trim() !== "" && (
        <p className="mt-1 text-xs text-amber-600">Pick a customer from the list</p>
      )}
    </div>
  );
}
