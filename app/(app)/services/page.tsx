import {
  getPackages,
  getServiceCategories,
  getServices,
} from "@/lib/actions/services";
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
  const [categories, services, packages, canManage] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getPackages(),
    canManageRecords(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-muted-foreground">
          Manage service categories, individual services, and packages.
        </p>
      </div>

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
            </CardHeader>
            <CardContent>
              <ServicesTable services={services} canManage={canManage} />
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
                  Bundle multiple services at a package price.
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
