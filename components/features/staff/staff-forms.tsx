"use client";

import { useActionState, useTransition } from "react";
import { createStaff, recordManualAttendance } from "@/lib/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/commerce";

export function StaffForm() {
  const [state, formAction, pending] = useActionState(createStaff, {} as ActionResult);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="full_name">Full name *</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="job_title">Job title</Label>
        <Input id="job_title" name="job_title" placeholder="Stylist" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin_code">Backup PIN</Label>
        <Input id="pin_code" name="pin_code" placeholder="Optional — for device fallback" />
      </div>
      {state.error && <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="sm:col-span-2 text-sm text-green-600">Staff added.</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>Add staff</Button>
      </div>
    </form>
  );
}

export function AttendanceButtons({ staffId }: { staffId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending}
        onClick={() => startTransition(async () => { await recordManualAttendance(staffId, "in"); })}>
        In
      </Button>
      <Button size="sm" variant="ghost" disabled={pending}
        onClick={() => startTransition(async () => { await recordManualAttendance(staffId, "out"); })}>
        Out
      </Button>
    </div>
  );
}
