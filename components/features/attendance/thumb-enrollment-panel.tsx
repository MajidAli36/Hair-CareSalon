"use client";

import { useActionState } from "react";
import { enrollStaffThumb, removeStaffThumb } from "@/lib/actions/staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/commerce";
import { formatDate } from "@/lib/format";
import { Fingerprint, Trash2 } from "lucide-react";

type StaffThumbRow = {
  id: string;
  full_name: string;
  thumb_id: string | null;
  thumb_enrolled_at: string | null;
};

type ThumbEnrollmentPanelProps = {
  staff: StaffThumbRow[];
  canManage: boolean;
  enrolledCount: number;
};

function EnrollForm({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [state, formAction, pending] = useActionState(enrollStaffThumb, {} as ActionResult);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="staff_id" value={staffId} />
      <div className="min-w-[140px] flex-1 space-y-1">
        <Label htmlFor={`thumb-${staffId}`} className="text-xs">
          Scanner ID for {staffName}
        </Label>
        <Input
          id={`thumb-${staffId}`}
          name="thumb_id"
          placeholder="From biometric device"
          required
          className="h-8"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Enroll thumb"}
      </Button>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-green-600">Thumb enrolled.</p>}
    </form>
  );
}

export function ThumbEnrollmentPanel({ staff, canManage, enrolledCount }: ThumbEnrollmentPanelProps) {
  const activeStaff = staff.filter((s) => s.id);
  const notEnrolled = activeStaff.filter((s) => !s.thumb_id);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="size-5" />
              Thumb impression enrollment
            </CardTitle>
            <CardDescription>
              Register each stylist&apos;s thumb on your biometric scanner, then link the scanner
              user ID here. Attendance is recorded automatically when they scan in or out.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            {enrolledCount} / {activeStaff.length} enrolled
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add staff profiles first.</p>
        ) : (
          <div className="space-y-3">
            {activeStaff.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{s.full_name}</p>
                  {s.thumb_id ? (
                    <p className="text-xs text-muted-foreground">
                      Thumb ID <code className="text-foreground">{s.thumb_id}</code>
                      {s.thumb_enrolled_at && (
                        <> · enrolled {formatDate(s.thumb_enrolled_at)}</>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Not enrolled yet</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-col gap-2 sm:items-end">
                    {!s.thumb_id ? (
                      <EnrollForm staffId={s.id} staffName={s.full_name} />
                    ) : (
                      <ConfirmAction
                        title="Remove thumb enrollment?"
                        description={`Remove thumb ID for ${s.full_name}? They will not be able to check in by thumb until enrolled again.`}
                        confirmLabel="Remove thumb"
                        pendingLabel="Removing…"
                        variant="outline"
                        onConfirm={async () => {
                          await removeStaffThumb(s.id);
                        }}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        Remove thumb
                      </ConfirmAction>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {notEnrolled.length > 0 && canManage && (
          <p className="text-xs text-muted-foreground">
            Tip: On the scanner, enroll the thumb first, then copy the user/slot ID into the field
            above. Or use <code>POST /api/devices/enroll-thumb</code> from the terminal software.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
