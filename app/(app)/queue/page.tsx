import { getQueueByDate } from "@/lib/actions/queue";
import { getCustomers } from "@/lib/actions/customers";
import { getStaff } from "@/lib/actions/staff";
import { getChairs } from "@/lib/actions/chairs";
import { canManageRecords } from "@/lib/auth/permissions";
import { QueueBoard } from "@/components/features/queue/queue-board";
import { getLocalDateString } from "@/lib/dates/local";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ date?: string; staff?: string; chair?: string }>;
};

export default async function QueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const date = params.date ?? getLocalDateString();

  const [tokens, customers, staff, chairs, canManage] = await Promise.all([
    getQueueByDate(date),
    getCustomers(),
    getStaff(),
    getChairs(),
    canManageRecords(),
  ]);

  const activeStaff = staff
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, full_name: s.full_name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Queue</h1>
          <p className="text-muted-foreground">
            Issue tokens with customer, optional staff and chair, and token time.
          </p>
        </div>
        {canManage && (
          <Link
            href="/chairs"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Manage chairs
          </Link>
        )}
      </div>
      <QueueBoard
        tokens={tokens}
        customers={customers}
        staff={activeStaff}
        chairs={chairs.map((c) => ({ id: c.id, name: c.name }))}
        date={date}
        tokenCount={tokens.length}
        canManageChairs={canManage}
      />
    </div>
  );
}
