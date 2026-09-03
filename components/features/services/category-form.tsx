"use client";

import { useActionState } from "react";
import { createCategory } from "@/lib/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/actions/customers";

export function CategoryForm() {
  const [state, formAction, pending] = useActionState(createCategory, {} as ActionResult);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="cat_name">Category name</Label>
        <Input id="cat_name" name="name" placeholder="Hair, Nails, Spa…" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sort_order">Order</Label>
        <Input id="sort_order" name="sort_order" type="number" defaultValue={0} min={0} className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add category"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
