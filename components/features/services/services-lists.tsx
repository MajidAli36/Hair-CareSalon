"use client";

import {
  DeleteCategoryButton,
  DeletePackageButton,
  DeleteServiceButton,
} from "@/components/features/services/delete-buttons";
import { EditServiceButton } from "@/components/features/services/edit-service-dialog";
import { ServiceConsumablesButton } from "@/components/features/services/service-consumables-dialog";
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
import { formatCurrency, formatDuration } from "@/lib/format";
import type { ServiceCategory } from "@/types";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  category_id: string | null;
  category: { id?: string; name: string } | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
};

type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  items: {
    id: string;
    quantity: number;
    service: { name: string } | null;
  }[] | null;
};

type ProductOption = {
  id: string;
  name: string;
  stock_quantity: number;
  sku: string | null;
};

export function ServicesTable({
  services,
  categories,
  canManage,
  products = [],
  consumableCounts = {},
}: {
  services: ServiceRow[];
  categories: ServiceCategory[];
  canManage: boolean;
  products?: ProductOption[];
  consumableCounts?: Record<string, number>;
}) {
  return (
    <PaginatedList
      items={services}
      empty={<p className="text-sm text-muted-foreground">No services yet.</p>}
    >
      {(slice) => (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Salon stock</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-[280px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((service) => {
                const linked = consumableCounts[service.id] ?? 0;
                return (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.category?.name ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(service.price)}</TableCell>
                    <TableCell>{formatDuration(service.duration_minutes)}</TableCell>
                    <TableCell>
                      {linked > 0 ? (
                        <Badge variant="secondary">
                          {linked} product{linked === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <EditServiceButton service={service} categories={categories} />
                          <ServiceConsumablesButton
                            serviceId={service.id}
                            serviceName={service.name}
                            products={products}
                            linkedCount={linked}
                          />
                          <DeleteServiceButton id={service.id} name={service.name} />
                        </div>
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

export function ServiceCategoriesTable({
  categories,
  canManage,
}: {
  categories: CategoryRow[];
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
                {canManage && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{cat.sort_order}</TableCell>
                  {canManage && (
                    <TableCell>
                      <DeleteCategoryButton id={cat.id} />
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

export function PackagesList({
  packages,
  canManage,
}: {
  packages: PackageRow[];
  canManage: boolean;
}) {
  return (
    <PaginatedList
      items={packages}
      empty={<p className="text-sm text-muted-foreground">No packages yet.</p>}
    >
      {(slice) => (
        <div className="space-y-4">
          {slice.map((pkg) => (
            <div key={pkg.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(pkg.price)}</span>
                  <Badge variant={pkg.is_active ? "default" : "secondary"}>
                    {pkg.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {canManage && <DeletePackageButton id={pkg.id} />}
                </div>
              </div>
              {pkg.items && pkg.items.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {pkg.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.service?.name ?? "Unknown service"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </PaginatedList>
  );
}
