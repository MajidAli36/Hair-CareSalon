import { getChairs } from "@/lib/actions/chairs";
import { canManageRecords } from "@/lib/auth/permissions";
import { ChairsManager } from "@/components/features/chairs/chairs-manager";

export default async function ChairsPage() {
  const [chairs, canManage] = await Promise.all([getChairs(true), canManageRecords()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chairs</h1>
        <p className="text-muted-foreground">
          Manage salon chairs and stations. Add or remove anytime — they show up on the Queue page.
        </p>
      </div>
      <ChairsManager chairs={chairs} canManage={canManage} />
    </div>
  );
}
