import { redirect } from "next/navigation";
import { getPosCatalog } from "@/lib/actions/products";
import { getAppointmentsForPos } from "@/lib/actions/appointments";
import { canUsePos } from "@/lib/auth/permissions";
import { PosTerminal } from "@/components/features/pos/pos-terminal";

export default async function PosPage() {
  const canPos = await canUsePos();
  if (!canPos) redirect("/dashboard");

  const [catalog, appointments] = await Promise.all([
    getPosCatalog(),
    getAppointmentsForPos().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
        <p className="text-muted-foreground">
          Add items to cart and complete checkout. Select an appointment to apply advance credit.
        </p>
      </div>
      <PosTerminal
        services={catalog.services}
        products={catalog.products}
        packages={catalog.packages}
        customers={catalog.customers}
        appointments={appointments}
      />
    </div>
  );
}
