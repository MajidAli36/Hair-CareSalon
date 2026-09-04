"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerStatementControls({
  csv,
  filename,
}: {
  csv: string;
  filename: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs">
          From
        </Label>
        <Input
          id="from"
          type="date"
          className="h-8 w-36"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => {
            const sp = new URLSearchParams(searchParams.toString());
            if (e.target.value) sp.set("from", e.target.value);
            else sp.delete("from");
            router.push(`?${sp.toString()}`);
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs">
          To
        </Label>
        <Input
          id="to"
          type="date"
          className="h-8 w-36"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => {
            const sp = new URLSearchParams(searchParams.toString());
            if (e.target.value) sp.set("to", e.target.value);
            else sp.delete("to");
            router.push(`?${sp.toString()}`);
          }}
        />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Export CSV
      </Button>
    </div>
  );
}
