import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSale } from "@/lib/actions/sales";
import { getSaleRefunds } from "@/lib/actions/sales-lifecycle";
import { getPosCatalog } from "@/lib/actions/products";
import { canManageRecords } from "@/lib/auth/permissions";
import { isPostedSaleStatus } from "@/lib/sales/lifecycle";
import { AmendSaleEditor } from "@/components/features/sales/amend-sale-editor";
import { Button } from "@/components/ui/button";
import { formatCustomerName } from "@/lib/format";
import type { SaleItemType } from "@/types/commerce";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditSalePage({ params }: PageProps) {
  const { id } = await params;
  const canManage = await canManageRecords();
  if (!canManage) redirect(`/sales/${id}`);

  const [sale, catalog, refunds] = await Promise.all([
    getSale(id),
    getPosCatalog(),
    getSaleRefunds(id).catch(() => []),
  ]);
  if (!sale) notFound();
  if (!isPostedSaleStatus(sale.status)) redirect(`/sales/${id}`);

  const items = (sale.items ?? []) as {
    id: string;
    name: string;
    item_type: SaleItemType;
    item_id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];

  const payments = (sale.payments ?? []) as { amount: number }[];
  const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const refundsTotal = (refunds ?? []).reduce(
    (s, r) => s + Number((r as { amount: number }).amount),
    0
  );

  const catalogItems = [
    ...catalog.services.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      itemType: "SERVICE" as const,
    })),
    ...catalog.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.retail_price),
      itemType: "PRODUCT" as const,
    })),
    ...catalog.packages.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      itemType: "PACKAGE" as const,
    })),
  ];

  const customers = catalog.customers.map((c) => ({
    id: c.id,
    label: formatCustomerName(c.first_name, c.last_name),
  }));

  const saleAny = sale as { current_version?: number };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Amend invoice</h1>
          <p className="text-muted-foreground">
            Edit a completed sale safely — inventory and payments will be reconciled.
          </p>
        </div>
        <Button variant="outline" render={<Link href={`/sales/${id}`} />}>
          Cancel
        </Button>
      </div>

      <AmendSaleEditor
        saleId={sale.id}
        currentVersion={Number(saleAny.current_version ?? 1)}
        oldTotal={Number(sale.total)}
        paymentsTotal={paymentsTotal}
        refundsTotal={refundsTotal}
        customerId={sale.customer_id ?? null}
        discount={Number(sale.discount)}
        tax={Number(sale.tax ?? 0)}
        notes={sale.notes}
        initialLines={items.map((item) => ({
          key: item.id,
          itemType: item.item_type,
          itemId: item.item_id,
          name: item.name,
          unitPrice: Number(item.unit_price),
          quantity: Number(item.quantity),
        }))}
        catalog={catalogItems}
        customers={customers}
      />
    </div>
  );
}
