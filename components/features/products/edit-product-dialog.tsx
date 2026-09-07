"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateProduct } from "@/lib/actions/products";
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
import type { ActionResult } from "@/types/commerce";
import type { Product, ProductCategory } from "@/types";

type EditableProduct = Product & {
  category: { id: string; name: string } | null;
};

export function EditProductButton({
  product,
  categories,
}: {
  product: EditableProduct;
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boundUpdate = updateProduct.bind(null, product.id);
  const [state, formAction, pending] = useActionState(boundUpdate, {} as ActionResult);

  useEffect(() => {
    if (!state.success) return;
    setOpen(false);
    router.refresh();
  }, [state.success, router]);

  const categoryId = product.category_id ?? product.category?.id ?? "none";

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
          <DialogTitle>Update product</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          className="grid gap-4 sm:grid-cols-2"
          key={`${product.id}-${open}`}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit_p_name_${product.id}`}>Product name *</Label>
            <Input
              id={`edit_p_name_${product.id}`}
              name="name"
              required
              defaultValue={product.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_sku_${product.id}`}>SKU</Label>
            <Input
              id={`edit_sku_${product.id}`}
              name="sku"
              defaultValue={product.sku ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_p_category_${product.id}`}>Category</Label>
            <select
              id={`edit_p_category_${product.id}`}
              name="category_id"
              defaultValue={!categoryId || categoryId === "none" ? "none" : categoryId}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="none">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit_usage_${product.id}`}>Product type *</Label>
            <select
              id={`edit_usage_${product.id}`}
              name="usage_kind"
              defaultValue={product.usage_kind ?? "BOTH"}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="RETAIL">Customer / retail (POS sale only)</option>
              <option value="SALON">In-house / salon (used inside services only)</option>
              <option value="BOTH">Both (sell on POS and use in services)</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit_p_desc_${product.id}`}>Description</Label>
            <Textarea
              id={`edit_p_desc_${product.id}`}
              name="description"
              rows={2}
              defaultValue={product.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_cost_${product.id}`}>Cost price</Label>
            <Input
              id={`edit_cost_${product.id}`}
              name="cost_price"
              type="number"
              min={0}
              step={1}
              defaultValue={product.cost_price}
            />
            <p className="text-xs text-muted-foreground">What you pay — inventory value.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_retail_${product.id}`}>Retail price *</Label>
            <Input
              id={`edit_retail_${product.id}`}
              name="retail_price"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={product.retail_price}
            />
            <p className="text-xs text-muted-foreground">POS selling price.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit_threshold_${product.id}`}>Low stock alert</Label>
            <Input
              id={`edit_threshold_${product.id}`}
              name="low_stock_threshold"
              type="number"
              min={0}
              defaultValue={product.low_stock_threshold}
            />
          </div>
          <div className="flex items-center gap-2 self-end pb-1">
            <input
              id={`edit_p_active_${product.id}`}
              name="is_active"
              type="checkbox"
              defaultChecked={product.is_active}
              className="size-4 rounded border"
            />
            <Label htmlFor={`edit_p_active_${product.id}`}>Active</Label>
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Current stock: <strong>{product.stock_quantity}</strong> — change stock under the
            Inventory tab (Adjust stock).
          </p>
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
