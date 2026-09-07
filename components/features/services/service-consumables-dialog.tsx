"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, ExternalLink, Package, Plus, Search, Trash2 } from "lucide-react";
import {
  getServiceConsumables,
  saveServiceConsumables,
} from "@/lib/actions/services";
import { getProductsForSalonLink } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProductOption = {
  id: string;
  name: string;
  stock_quantity: number;
  sku: string | null;
};

type Row = {
  key: string;
  productId: string;
  quantity: number;
};

function ProductPicker({
  products,
  value,
  usedIds,
  onChange,
}: {
  products: ProductOption[];
  value: string;
  usedIds: Set<string>;
  onChange: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = products.find((p) => p.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (usedIds.has(p.id) && p.id !== value) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, usedIds, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="truncate">
          {selected
            ? `${selected.name}${selected.sku ? ` (${selected.sku})` : ""}`
            : "Search & select product…"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>
      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type product name…"
              className="h-8 pl-8"
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-auto py-0.5">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    p.id === value && "bg-muted"
                  )}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      p.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {p.name}
                    {p.sku ? (
                      <span className="text-muted-foreground"> · {p.sku}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    stock {p.stock_quantity}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">No matching product</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ServiceConsumablesButton({
  serviceId,
  serviceName,
  products: initialProducts = [],
  linkedCount = 0,
}: {
  serviceId: string;
  serviceName: string;
  products?: ProductOption[];
  linkedCount?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>(initialProducts);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      getServiceConsumables(serviceId),
      getProductsForSalonLink().catch(() => initialProducts),
    ])
      .then(([data, catalog]) => {
        if (cancelled) return;
        setProducts(catalog);
        const nextRows = data.map((r) => ({
          key: r.id,
          productId: r.product_id,
          quantity: Number(r.quantity) || 1,
        }));
        // Start with one empty row so Admin can link immediately when catalog exists
        if (nextRows.length === 0 && catalog.length > 0) {
          setRows([{ key: `new-${Date.now()}`, productId: "", quantity: 1 }]);
        } else {
          setRows(nextRows);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, serviceId, initialProducts]);

  const usedIds = useMemo(
    () => new Set(rows.map((r) => r.productId).filter(Boolean)),
    [rows]
  );

  function addRow() {
    setRows((prev) => {
      if (prev.length >= products.length) return prev;
      return [
        ...prev,
        {
          key: `new-${Date.now()}-${prev.length}`,
          productId: "",
          quantity: 1,
        },
      ];
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Package className="size-3.5" />
            Salon stock
            {linkedCount > 0 ? (
              <Badge variant="secondary" className="ml-0.5">
                {linkedCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Salon stock used — {serviceName}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Only <span className="font-medium text-foreground">In-house</span> or{" "}
          <span className="font-medium text-foreground">Both</span> products appear here. Customer
          invoice still shows the service price only.
        </p>

        <ol className="list-decimal space-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground pl-8">
          <li>
            Create products under{" "}
            <Link href="/products" className="font-medium text-primary hover:underline">
              Products
            </Link>{" "}
            and Stock in.
          </li>
          <li>Link every product this service uses (as many as needed).</li>
          <li>Set qty used per ticket for each product.</li>
          <li>Save — POS deducts all of them when this service is sold.</li>
        </ol>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading products…</p>
        ) : products.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed px-3 py-4">
            <p className="text-sm text-destructive">
              No in-house products yet. Under Products, add a product with type{" "}
              <strong>In-house</strong> (or Both), Stock in, then link here.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={<Link href="/products" />}
            >
              <ExternalLink className="size-3.5" />
              Go to Products
            </Button>
          </div>
        ) : (
          <div className="max-h-[min(50vh,420px)] space-y-3 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No salon products linked yet. Click <strong>Add product</strong> to start.
              </p>
            ) : (
              rows.map((row, index) => {
                const product = products.find((p) => p.id === row.productId);
                return (
                  <div key={row.key} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium text-foreground">
                        Product {index + 1}
                        {rows.length > 1 ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            of {rows.length}
                          </span>
                        ) : null}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() =>
                          setRows((prev) => prev.filter((r) => r.key !== row.key))
                        }
                        aria-label="Remove product"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <ProductPicker
                      products={products}
                      value={row.productId}
                      usedIds={usedIds}
                      onChange={(productId) =>
                        setRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, productId } : r))
                        )
                      }
                    />
                    <div className="flex items-end gap-3">
                      <div className="w-28 space-y-1.5">
                        <Label htmlFor={`qty-${row.key}`}>Qty used</Label>
                        <Input
                          id={`qty-${row.key}`}
                          type="number"
                          min={1}
                          step={1}
                          value={row.quantity}
                          onChange={(e) => {
                            const quantity = Math.max(
                              1,
                              Math.floor(Number(e.target.value) || 1)
                            );
                            setRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key ? { ...r, quantity } : r
                              )
                            );
                          }}
                        />
                      </div>
                      {product ? (
                        <p className="pb-2 text-xs text-muted-foreground">
                          On hand now:{" "}
                          <span className="font-medium">{product.stock_quantity}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
            <div className="sticky bottom-0 space-y-2 bg-background pt-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full gap-1.5"
                onClick={addRow}
                disabled={rows.length >= products.length}
              >
                <Plus className="size-3.5" />
                Add another product
              </Button>
              {rows.length >= products.length ? (
                <p className="text-xs text-muted-foreground">
                  All catalog products are already linked. To use more items, add them under{" "}
                  <Link href="/products" className="text-primary hover:underline">
                    Products
                  </Link>{" "}
                  first.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {rows.filter((r) => r.productId).length} linked · you can add{" "}
                  {products.length - rows.length} more from your catalog.
                </p>
              )}
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || loading || products.length === 0}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const incomplete = rows.some((r) => !r.productId);
                if (incomplete) {
                  setError("Select a product for every row, or remove empty rows.");
                  return;
                }
                if (rows.length === 0) {
                  setError(null);
                }
                const payload = rows.map((r) => ({
                  productId: r.productId,
                  quantity: r.quantity,
                }));
                const res = await saveServiceConsumables(serviceId, payload);
                if (res.error) {
                  setError(res.error);
                  return;
                }
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending
              ? "Saving…"
              : rows.length > 1
                ? `Save ${rows.length} products`
                : "Save salon stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
