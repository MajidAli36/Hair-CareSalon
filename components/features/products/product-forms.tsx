"use client";

import { useActionState } from "react";
import { createProduct, createProductCategory } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/types/commerce";
import type { ProductCategory } from "@/types";

export function ProductCategoryForm() {
  const [state, formAction, pending] = useActionState(createProductCategory, {} as ActionResult);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="pc_name">Category name</Label>
        <Input id="pc_name" name="name" required />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add category"}</Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function ProductForm({ categories }: { categories: ProductCategory[] }) {
  const [state, formAction, pending] = useActionState(createProduct, {} as ActionResult);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="p_name">Product name *</Label>
        <Input id="p_name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p_category">Category</Label>
        <select id="p_category" name="category_id" className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
          <option value="none">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="p_desc">Description</Label>
        <Textarea id="p_desc" name="description" rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost">Cost price (what you pay)</Label>
        <Input id="cost" name="cost_price" type="number" min={0} step="1" defaultValue={0} />
        <p className="text-xs text-muted-foreground">Used for inventory value &amp; profit — not shown to customers.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="retail">Retail price (POS selling price) *</Label>
        <Input id="retail" name="retail_price" type="number" min={0} step="1" required defaultValue={0} />
        <p className="text-xs text-muted-foreground">Charged at checkout. Margin = retail − cost.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stock">Initial stock</Label>
        <Input id="stock" name="stock_quantity" type="number" min={0} defaultValue={0} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="threshold">Low stock alert</Label>
        <Input id="threshold" name="low_stock_threshold" type="number" min={0} defaultValue={5} />
      </div>
      <div className="flex items-center gap-2">
        <input id="p_active" name="is_active" type="checkbox" defaultChecked className="size-4 rounded border" />
        <Label htmlFor="p_active">Active</Label>
      </div>
      <div className="sm:col-span-2">
        {state.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="mb-2 text-sm text-green-600">Product added.</p>}
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add product"}</Button>
      </div>
    </form>
  );
}
