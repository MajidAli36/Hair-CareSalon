"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStaff, setStaffActive } from "@/lib/actions/staff";
import { setStaffOnlineBooking } from "@/lib/actions/scheduling";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";

export function StaffRowActions({
  staffId,
  name,
  isActive,
  onlineBookingEnabled,
}: {
  staffId: string;
  name: string;
  isActive: boolean;
  onlineBookingEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !isActive}
        title={
          !isActive
            ? "Activate staff before enabling online booking"
            : onlineBookingEnabled
              ? "Hide from public /book page"
              : "Show on public /book page"
        }
        onClick={() =>
          startTransition(async () => {
            await setStaffOnlineBooking(staffId, !onlineBookingEnabled);
            router.refresh();
          })
        }
      >
        {onlineBookingEnabled ? "Hide from booking" : "Show on booking"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setStaffActive(staffId, !isActive);
            router.refresh();
          })
        }
      >
        {isActive ? "Disable" : "Enable"}
      </Button>
      <ConfirmAction
        title={`Delete ${name}?`}
        description="Removes this salon profile. If payroll or other records block delete, they will be deactivated instead. Past sales stay intact."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        variant="ghost"
        onConfirm={async () => {
          const result = await deleteStaff(staffId);
          if (result.error) throw new Error(result.error);
          router.refresh();
        }}
      >
        Delete
      </ConfirmAction>
    </div>
  );
}
