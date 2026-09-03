"use client";

import {
  DeleteProductButton,
  DeleteProductCategoryButton,
} from "@/components/features/products/product-actions";
import { Badge } from "@/components/ui/badge";
import { PaginatedList } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getProductValuation, getTransactionValue } from "@/lib/inventory/valuation";
import type { Product, ProductCategory } from "@/types";

type ProductRow = Product & { category: { id: string; name: string } | null };

type TransactionRow = {
  id: string;
  type: string;
  quantity: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    cost_price: number;
    retail_price: number;
  } | null;
};

export function ProductsTable({
  products,
  canManage,
}: {
  products: ProductRow[];
  canManage: boolean;
}) {
  return (
    <PaginatedList
      items={products}
      empty={<p className="text-sm text-muted-foreground">No products yet.</p>}
    >
      {(slice) => (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Stock value</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((p) => {
                const v = getProductValuation(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(v.costPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(v.retailPrice)}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {formatCurrency(v.unitMargin)}
                      {v.marginPercent > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({v.marginPercent}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          p.stock_quantity <= p.low_stock_threshold
                            ? "font-medium text-destructive"
                            : ""
                        }
                      >
                        {v.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(v.stockValueAtCost)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DeleteProductButton id={p.id} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}

export function ProductCategoriesTable({
  categories,
  canManage,
}: {
  categories: ProductCategory[];
  canManage: boolean;
}) {
  return (
    <PaginatedList
      items={categories}
      empty={<p className="text-sm text-muted-foreground">No categories yet.</p>}
    >
      {(slice) => (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Order</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  {canManage && (
                    <TableCell>
                      <DeleteProductCategoryButton id={c.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}

export function InventoryValuationTable({ products }: { products: ProductRow[] }) {
  return (
    <PaginatedList
      items={products}
      empty={<p className="text-sm text-muted-foreground">No products yet.</p>}
    >
      {(slice) => (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">At cost</TableHead>
                <TableHead className="text-right">At retail</TableHead>
                <TableHead className="text-right">Potential profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((p) => {
                const v = getProductValuation(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{v.stock}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(v.stockValueAtCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(v.stockValueAtRetail)}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {formatCurrency(v.potentialProfit)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}

export function InventoryTransactionsTable({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  return (
    <PaginatedList
      items={transactions}
      empty={<p className="text-sm text-muted-foreground">No transactions yet.</p>}
    >
      {(slice) => (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Value (cost)</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((t) => {
                const cost = t.product?.cost_price ?? 0;
                const value = getTransactionValue(
                  t.quantity,
                  cost,
                  t.type as "IN" | "OUT" | "ADJUSTMENT"
                );
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.product?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.type === "IN"
                            ? "default"
                            : t.type === "OUT"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{t.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {t.type === "ADJUSTMENT"
                        ? "—"
                        : `${t.type === "OUT" ? "−" : "+"}${formatCurrency(value)}`}
                    </TableCell>
                    <TableCell>{formatDateTime(t.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}
