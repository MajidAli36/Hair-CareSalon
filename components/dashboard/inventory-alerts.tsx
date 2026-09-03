import Link from "next/link";
import { AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InventoryAlertsProps = {
  products: { id: string; name: string; stock: number; threshold: number }[];
};

export function InventoryAlerts({ products }: InventoryAlertsProps) {
  return (
    <div className="dashboard-card flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Inventory Alerts</h3>
          <p className="text-xs text-muted-foreground">
            {products.length === 0 ? "All stock levels healthy" : `${products.length} items need attention`}
          </p>
        </div>
        <Button variant="ghost" size="sm" render={<Link href="/products" />}>
          View inventory
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#16a34a]/10">
            <Package className="size-4 text-[#16a34a]" />
          </div>
          <p className="text-sm font-medium text-foreground">Stock levels look good</p>
          <p className="mt-1 text-xs text-muted-foreground">No products below threshold.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {products.map((product) => {
            const critical = product.stock <= Math.max(1, Math.floor(product.threshold / 2));
            return (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      critical ? "bg-destructive/10" : "bg-[#d97706]/10"
                    )}
                  >
                    <AlertTriangle
                      className={cn("size-4", critical ? "text-destructive" : "text-[#d97706]")}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.stock} remaining · threshold {product.threshold}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0 text-[10px]",
                    critical
                      ? "bg-destructive/10 text-destructive"
                      : "bg-[#d97706]/10 text-[#d97706]"
                  )}
                >
                  {critical ? "Critical" : "Low stock"}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
