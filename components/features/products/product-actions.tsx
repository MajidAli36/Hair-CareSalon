"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { adjustInventory, deleteProduct, deleteProductCategory } from "@/lib/actions/products";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/commerce";

const deleteBtnClass =
  "gap-1.5 border-destructive/25 bg-destructive/5 text-destructive shadow-sm transition-all hover:border-destructive/50 hover:bg-destructive hover:text-destructive-foreground hover:shadow-md";

export function DeleteProductButton({ id, name }: { id: string; name?: string }) {
  return (
    <ConfirmAction
      title="Delete product?"
      description={
        name
          ? `Delete “${name}”? Stock history for this product will remain in reports.`
          : "This product will be permanently deleted."
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      variant="outline"
      className={deleteBtnClass}
      onConfirm={async () => {
        await deleteProduct(id);
      }}
    >
      <Trash2 className="size-3.5" />
      Delete
    </ConfirmAction>
  );
}

export function DeleteProductCategoryButton({ id, name }: { id: string; name?: string }) {
  return (
    <ConfirmAction
      title="Delete category?"
      description={
        name
          ? `Delete “${name}”? Products in this category may need reassignment.`
          : "This category will be permanently deleted."
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      variant="outline"
      className={deleteBtnClass}
      onConfirm={async () => {
        await deleteProductCategory(id);
      }}
    >
      <Trash2 className="size-3.5" />
      Delete
    </ConfirmAction>
  );
}

export function InventoryAdjustForm({ products }: { products: { id: string; name: string; stock_quantity: number }[] }) {
  const [state, formAction, pending] = useActionState(adjustInventory, {} as ActionResult);
  if (products.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="product_id">Product</Label>
        <select id="product_id" name="product_id" required className="flex h-8 min-w-[180px] rounded-lg border border-input bg-background px-2.5 text-sm">
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} (stock: {p.stock_quantity})</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <select id="type" name="type" className="flex h-8 rounded-lg border border-input bg-background px-2.5 text-sm">
          <option value="IN">Stock in</option>
          <option value="OUT">Stock out</option>
          <option value="ADJUSTMENT">Set quantity</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="qty">Quantity</Label>
        <Input id="qty" name="quantity" type="number" min={1} required defaultValue={1} className="w-24" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record"}</Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-600">Inventory updated.</p>}
    </form>
  );
}
