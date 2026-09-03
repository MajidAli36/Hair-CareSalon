import Link from "next/link";
import { getSales } from "@/lib/actions/sales";
import { SalesTableCard } from "@/components/features/sales/sales-table";
import { Button } from "@/components/ui/button";

export default async function SalesPage() {
  const sales = await getSales();

  const rows = sales.map((sale) => ({
    id: sale.id,
    total: sale.total,
    status: sale.status,
    completed_at: sale.completed_at,
    created_at: sale.created_at,
    customer: sale.customer as { first_name: string; last_name: string | null } | null,
    invoice: sale.invoice as
      | { invoice_number: string }[]
      | { invoice_number: string }
      | null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground">View completed and voided transactions.</p>
        </div>
        <Button render={<Link href="/pos" />}>New sale</Button>
      </div>

      <SalesTableCard sales={rows} />
    </div>
  );
}
