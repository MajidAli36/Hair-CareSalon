"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateService } from "@/lib/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/actions/customers";
import type { ServiceCategory } from "@/types";

export type EditableService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  category_id: string | null;
  category: { id?: string; name: string } | null;
};

export function EditServiceButton({
  service,
  categories,
}: {
  service: EditableService;
  categories: ServiceCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boundUpdate = updateService.bind(null, service.id);
  const [state, formAction, pending] = useActionState(boundUpdate, {} as ActionResult);

  useEffect(() => {
    if (!state.success) return;
    setOpen(false);
    router.refresh();
  }, [state.success, router]);

  const categoryId = service.category_id ?? service.category?.id ?? "none";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update service</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          className="grid gap-4 sm:grid-cols-2"
          key={`${service.id}-${open}`}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit_svc_name_${service.id}`}>Service name *</Label>
            <Input
              id={`edit_svc_name_${service.id}`}
              name="name"
              required
              defaultValue={service.name}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit_description_${service.id}`}>Description</Label>
            <Textarea
              id={`edit_description_${service.id}`}
              name="description"
              rows={2}
              defaultValue={service.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_category_${service.id}`}>Category</Label>
            <select
              id={`edit_category_${service.id}`}
              name="category_id"
              defaultValue={!categoryId || categoryId === "none" ? "none" : categoryId}
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
            <Label htmlFor={`edit_price_${service.id}`}>Price (PKR) *</Label>
            <Input
              id={`edit_price_${service.id}`}
              name="price"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={service.price}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_duration_${service.id}`}>Duration (minutes) *</Label>
            <Input
              id={`edit_duration_${service.id}`}
              name="duration_minutes"
              type="number"
              min={1}
              required
              defaultValue={service.duration_minutes}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id={`edit_active_${service.id}`}
              name="is_active"
              type="checkbox"
              defaultChecked={service.is_active}
              className="size-4 rounded border"
            />
            <Label htmlFor={`edit_active_${service.id}`}>Active</Label>
          </div>
          {state.error ? (
            <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
