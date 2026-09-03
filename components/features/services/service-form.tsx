"use client";

import { useActionState } from "react";
import { createService } from "@/lib/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions/customers";
import type { ServiceCategory } from "@/types";

type ServiceFormProps = {
  categories: ServiceCategory[];
};

export function ServiceForm({ categories }: ServiceFormProps) {
  const [state, formAction, pending] = useActionState(createService, {} as ActionResult);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="svc_name">Service name *</Label>
        <Input id="svc_name" name="name" required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category_id">Category</Label>
        <select
          id="category_id"
          name="category_id"
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="none">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Price (PKR) *</Label>
        <Input id="price" name="price" type="number" min={0} step={1} required defaultValue={0} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
        <Input id="duration_minutes" name="duration_minutes" type="number" min={1} required defaultValue={30} />
      </div>
      <div className="flex items-center gap-2">
        <input id="is_active" name="is_active" type="checkbox" defaultChecked className="size-4 rounded border" />
        <Label htmlFor="is_active">Active</Label>
      </div>
      <div className="sm:col-span-2">
        {state.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="mb-2 text-sm text-green-600">Service added.</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add service"}
        </Button>
      </div>
    </form>
  );
}
