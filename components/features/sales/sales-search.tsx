"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SalesSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleSearch = useCallback(
    (next: string) => {
      setValue(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      startTransition(() => {
        router.replace(`/sales?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div className="relative max-w-md flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search invoice, customer, phone…"
        className="pl-9"
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        disabled={isPending}
      />
    </div>
  );
}
