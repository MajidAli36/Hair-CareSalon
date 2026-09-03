"use client";

import { useActionState } from "react";
import { createPackage } from "@/lib/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions/customers";
import type { Service } from "@/types";

type PackageFormProps = {
  services: Service[];
};

export function PackageForm({ services }: PackageFormProps) {
  const [state, formAction, pending] = useActionState(createPackage, {} as ActionResult);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pkg_name">Package name *</Label>
          <Input id="pkg_name" name="name" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pkg_description">Description</Label>
          <Textarea id="pkg_description" name="description" rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pkg_price">Package price (PKR) *</Label>
          <Input id="pkg_price" name="price" type="number" min={0} required defaultValue={0} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="pkg_active" name="is_active" type="checkbox" defaultChecked className="size-4 rounded border" />
          <Label htmlFor="pkg_active">Active</Label>
        </div>
      </div>

      {services.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4">
          <Label>Included services (set quantity, 0 to exclude)</Label>
          {services.map((service) => (
            <div key={service.id} className="flex items-center gap-3">
              <input type="hidden" name="service_ids" value={service.id} />
              <span className="flex-1 text-sm">{service.name}</span>
              <Input
                name="quantities"
                type="number"
                min={0}
                defaultValue={0}
                className="w-16"
                aria-label={`Quantity for ${service.name}`}
              />
            </div>
          ))}
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">Package created.</p>}

      <Button type="submit" disabled={pending || services.length === 0}>
        {pending ? "Creating…" : "Create package"}
      </Button>
    </form>
  );
}
