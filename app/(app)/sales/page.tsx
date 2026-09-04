import { Suspense } from "react";
import Link from "next/link";
import { getSales } from "@/lib/actions/sales";
import { canManageRecords, canUsePos } from "@/lib/auth/permissions";
import { SalesTableCard } from "@/components/features/sales/sales-table";
import { SalesSearch } from "@/components/features/sales/sales-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type SalesPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;

  const [sales, canManage, canPos] = await Promise.all([
    getSales({ search: q }),
    canManageRecords(),
    canUsePos(),
  ]);

  const rows = sales.map((sale) => {
    const s = sale as typeof sale & {
      payment_status?: string;
      amount_paid?: number;
      amount_due?: number;
      payment_version?: number;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground">
            View invoices, collect dues, amend, refund, or void. Payment status is separate from
            sale status.
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
        emptyLabel={
          q
            ? `No sales match “${q}”. Try invoice number, customer name, or phone.`
            : undefined
        }
      />
    </div>
  );
}
