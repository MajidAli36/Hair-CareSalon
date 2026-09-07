import {
  getPackages,
  getServiceCategories,
  getServiceConsumableCounts,
  getServices,
} from "@/lib/actions/services";
import { getProductsForSalonLink } from "@/lib/actions/products";
import { canManageRecords } from "@/lib/auth/permissions";
import { CategoryForm } from "@/components/features/services/category-form";
import { PackageForm } from "@/components/features/services/package-form";
import { ServiceForm } from "@/components/features/services/service-form";
import {
  PackagesList,
  ServiceCategoriesTable,
  ServicesTable,
} from "@/components/features/services/services-lists";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ServicesPage() {
  const [categories, services, packages, canManage, products, consumableCounts] =
    await Promise.all([
      getServiceCategories(),
      getServices(),
      getPackages(),
      canManageRecords(),
      getProductsForSalonLink().catch(() => []),
      getServiceConsumableCounts().catch(() => ({}) as Record<string, number>),
    ]);

  const productOptions = products ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-muted-foreground">
          Manage service categories, individual services, and packages.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How to link Salon stock</CardTitle>
            <CardDescription className="space-y-2">
              <span className="block">
                1. Go to <span className="font-medium text-foreground">Products</span> → add an{" "}
                <span className="font-medium text-foreground">In-house</span> product (or Both) and
                Stock in.
              </span>
              <span className="block">
                2. Back here → click <span className="font-medium text-foreground">Salon stock</span>{" "}
                on a service → link those in-house products → Save.
              </span>
              <span className="block">
                3. Customer/retail products stay on POS only. In-house products do not appear as POS
                sell lines.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="packages">Packages ({packages.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Add service</CardTitle>
                <CardDescription>Create a new salon service.</CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceForm categories={categories} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>All services</CardTitle>
              <CardDescription>
                After creating a service, open{" "}
                <span className="font-medium text-foreground">Salon stock</span> to set which
                products are consumed per ticket.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServicesTable
                services={services}
                categories={categories}
                canManage={canManage}
                products={productOptions}
                consumableCounts={consumableCounts}
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
                <CategoryForm />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceCategoriesTable categories={categories} canManage={canManage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Create package</CardTitle>
                <CardDescription>
                  Bundle multiple services at a package price. Salon stock recipes on each
                  included service still apply when the package is sold.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PackageForm services={services} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Packages</CardTitle>
            </CardHeader>
            <CardContent>
              <PackagesList packages={packages} canManage={canManage} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
