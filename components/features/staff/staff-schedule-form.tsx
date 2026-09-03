"use client";

import { useActionState, useMemo, useState } from "react";
import { saveStaffSchedule } from "@/lib/actions/scheduling";
import { DAY_NAMES } from "@/lib/booking/constants";
import { getLocalDateString } from "@/lib/dates/local";
import type { ActionResult } from "@/types/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StaffScheduleEntry = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type StaffScheduleFormProps = {
  staff: { id: string; full_name: string }[];
  schedules?: StaffScheduleEntry[];
};

function dayOfWeekFromDate(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

function timeForInput(value: string): string {
  return value.slice(0, 5);
}

export function StaffScheduleForm({ staff, schedules = [] }: StaffScheduleFormProps) {
  const [state, formAction, pending] = useActionState(saveStaffSchedule, {} as ActionResult);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [scheduleDate, setScheduleDate] = useState(getLocalDateString);

  const dayOfWeek = useMemo(() => dayOfWeekFromDate(scheduleDate), [scheduleDate]);
  const existingSchedule = useMemo(
    () => schedules.find((row) => row.staff_id === staffId && row.day_of_week === dayOfWeek),
    [schedules, staffId, dayOfWeek]
  );
  const startTime = existingSchedule ? timeForInput(existingSchedule.start_time) : "09:00";
  const endTime = existingSchedule ? timeForInput(existingSchedule.end_time) : "18:00";
  const timeFieldKey = `${staffId}-${dayOfWeek}-${startTime}-${endTime}`;

  if (!staff.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff schedules</CardTitle>
        <CardDescription>
          Pick a date to set recurring weekly hours for that weekday. Hours apply to both reception
          and online bookings — shared calendar, no double booking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="schedule-staff">Staff</Label>
            <select
              id="schedule-staff"
              name="staff_id"
              required
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-date">Date</Label>
            <Input
              id="schedule-date"
              type="date"
              required
              value={scheduleDate}
              className="h-8"
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <input type="hidden" name="day_of_week" value={dayOfWeek} />
            <p className="text-xs text-muted-foreground">
              Recurring every {DAY_NAMES[dayOfWeek]}
              {existingSchedule ? " · saved hours loaded" : ""}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-opens">Opens</Label>
            <Input
              key={`start-${timeFieldKey}`}
              id="schedule-opens"
              name="start_time"
              type="time"
              required
              defaultValue={startTime}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-closes">Closes</Label>
            <Input
              key={`end-${timeFieldKey}`}
              id="schedule-closes"
              name="end_time"
              type="time"
              required
              defaultValue={endTime}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save hours"}
            </Button>
          </div>
          {state.error && <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="sm:col-span-2 text-sm text-green-600">Schedule saved.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
