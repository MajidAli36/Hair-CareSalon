import Link from "next/link";
import {
  getInventorySummaryStats,
  getInventoryTransactions,
  getProductCategories,
  getProducts,
} from "@/lib/actions/products";
import { canManageRecords } from "@/lib/auth/permissions";
import { InventoryAdjustForm } from "@/components/features/products/product-actions";
import { InventorySummaryCards } from "@/components/features/products/inventory-summary";
import { ProductCategoryForm, ProductForm } from "@/components/features/products/product-forms";
import {
  InventoryTransactionsTable,
  InventoryValuationTable,
  ProductCategoriesTable,
  ProductsTable,
} from "@/components/features/products/products-lists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProductsPageProps = {
  searchParams: Promise<{ usage?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const usageFilter =
    params.usage === "RETAIL" || params.usage === "SALON" || params.usage === "BOTH"
      ? params.usage
      : "ALL";

  const [categories, products, transactions, inventorySummary, canManage] = await Promise.all([
    getProductCategories(),
    getProducts(),
    getInventoryTransactions(),
    getInventorySummaryStats(),
    canManageRecords(),
  ]);

  const filtered =
    usageFilter === "ALL"
      ? products
      : products.filter((p) => (p.usage_kind ?? "BOTH") === usageFilter);

  const retailCount = products.filter((p) => (p.usage_kind ?? "BOTH") === "RETAIL").length;
  const salonCount = products.filter((p) => (p.usage_kind ?? "BOTH") === "SALON").length;
  const bothCount = products.filter((p) => (p.usage_kind ?? "BOTH") === "BOTH").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Keep <span className="font-medium text-foreground">Customer</span> products (POS) and{" "}
          <span className="font-medium text-foreground">In-house</span> products (used inside
          services) separate. Stock stays on one inventory ledger.
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Add product</CardTitle>
                <CardDescription>
                  Choose type: Customer (POS), In-house (Services → Salon stock), or Both. Set cost
                  for inventory value; retail is for POS selling price.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductForm categories={categories} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>All products</CardTitle>
              <CardDescription>
                Filter by type. In-house items do not appear on POS; Customer items do not appear in
                Salon stock linking.
              </CardDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                {(
                  [
                    ["ALL", `All (${products.length})`],
                    ["RETAIL", `Customer (${retailCount})`],
                    ["SALON", `In-house (${salonCount})`],
                    ["BOTH", `Both (${bothCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={usageFilter === key ? "default" : "outline"}
                    render={
                      <Link
                        href={
                          key === "ALL" ? "/products" : `/products?usage=${key}`
                        }
                      />
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ProductsTable
                products={filtered}
                categories={categories}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Add category</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductCategoryForm />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductCategoriesTable categories={categories} canManage={canManage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <InventorySummaryCards summary={inventorySummary} />

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Adjust stock</CardTitle>
                <CardDescription>
                  Stock In adds units, Stock Out removes, Adjustment sets exact count. Works for
                  Customer and In-house products.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryAdjustForm products={products} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Stock valuation by product</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryValuationTable products={products} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>
                POS retail sales and service salon-use both record Stock Out.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryTransactionsTable transactions={transactions} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
