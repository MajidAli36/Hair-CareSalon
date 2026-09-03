"use client";

import { useTransition } from "react";
import { setStaffOnlineBooking } from "@/lib/actions/scheduling";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StaffRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  online_booking_enabled: boolean;
};

type StaffOnlineToggleProps = {
  staff: StaffRow[];
  onStaffChange?: (staff: StaffRow[]) => void;
};

export function StaffOnlineToggle({ staff, onStaffChange }: StaffOnlineToggleProps) {
  const [pending, startTransition] = useTransition();

  function toggle(staffId: string, enabled: boolean) {
    const previous = staff;
    const optimistic = staff.map((s) =>
      s.id === staffId ? { ...s, online_booking_enabled: enabled } : s
    );
    onStaffChange?.(optimistic);

    startTransition(async () => {
      const result = await setStaffOnlineBooking(staffId, enabled);
      if (result.error) {
        onStaffChange?.(previous);
      }
    });
  }

  if (!staff.length) {
    return <p className="text-sm text-muted-foreground">Add staff members first.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Online booking</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.full_name}</TableCell>
            <TableCell>{s.job_title ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={s.online_booking_enabled ? "default" : "secondary"}>
                {s.online_booking_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </TableCell>
            <TableCell>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => toggle(s.id, !s.online_booking_enabled)}
              >
                {s.online_booking_enabled ? "Disable" : "Enable"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
