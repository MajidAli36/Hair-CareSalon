import { Suspense } from "react";
import Link from "next/link";
import { getSales } from "@/lib/actions/sales";
import { canAdminDeleteSales, canManageRecords, canUsePos } from "@/lib/auth/permissions";
import { SalesTableCard } from "@/components/features/sales/sales-table";
import { SalesSearch } from "@/components/features/sales/sales-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalePaymentStatus } from "@/types/commerce";

const PAYMENT_STATUSES = new Set<SalePaymentStatus>([
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
]);

type SalesPageProps = {
  searchParams: Promise<{ q?: string; payment_status?: string }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const paymentRaw = params.payment_status?.trim();
  const paymentStatus =
    paymentRaw && PAYMENT_STATUSES.has(paymentRaw as SalePaymentStatus)
      ? (paymentRaw as SalePaymentStatus)
      : undefined;

  const [sales, canManage, canPos, canAdminDelete] = await Promise.all([
    getSales({ search: q, paymentStatus, includeDeleted: true }),
    canManageRecords(),
    canUsePos(),
    canAdminDeleteSales(),
  ]);

  const rows = sales.map((sale) => {
    const s = sale as typeof sale & {
      payment_status?: string;
      amount_paid?: number;
      amount_due?: number;
      payment_version?: number;
      deleted_at?: string | null;
    };
    return {
      id: s.id,
      total: s.total,
      status: s.status,
      payment_status: s.payment_status,
      amount_paid: s.amount_paid,
      amount_due: s.amount_due,
      payment_version: s.payment_version,
      completed_at: s.completed_at,
      created_at: s.created_at,
      deleted_at: s.deleted_at ?? null,
      customer: s.customer as {
        first_name: string;
        last_name: string | null;
        phone?: string | null;
      } | null,
      invoice: s.invoice as
        | { invoice_number: string }[]
        | { invoice_number: string }
        | null,
    };
  });

  const filterHint = [q ? `“${q}”` : null, paymentStatus ? paymentStatus.replaceAll("_", " ") : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground">
            View invoices, collect dues, amend, refund, or void. Payment status is separate from
            sale status. Deleted invoices stay listed but are locked.
          </p>
        </div>
        <Button render={<Link href="/pos" />}>New sale</Button>
      </div>

      <Suspense fallback={<Skeleton className="h-10 max-w-md" />}>
        <SalesSearch />
      </Suspense>

      <SalesTableCard
        sales={rows}
        canManage={canManage}
        canReceivePayment={canPos || canManage}
        canAdminDelete={canAdminDelete}
        emptyLabel={
          filterHint
            ? `No sales match ${filterHint}. Try invoice number, customer name, phone, or payment status.`
            : undefined
        }
      />
    </div>
  );
}
