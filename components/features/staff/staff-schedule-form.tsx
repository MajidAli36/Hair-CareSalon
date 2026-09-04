"use client";

import { useActionState, useMemo, useState } from "react";
import { saveStaffSchedule } from "@/lib/actions/scheduling";
import { DAY_NAMES } from "@/lib/booking/constants";
import { getLocalDateString, getLocalDayOfWeek } from "@/lib/dates/local";
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

function timeForInput(value: string): string {
  return value.slice(0, 5);
}

export function StaffScheduleForm({ staff, schedules = [] }: StaffScheduleFormProps) {
  const [state, formAction, pending] = useActionState(saveStaffSchedule, {} as ActionResult);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [scheduleDate, setScheduleDate] = useState(getLocalDateString);

  const dayOfWeek = useMemo(() => getLocalDayOfWeek(scheduleDate), [scheduleDate]);
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
      <CardContent className="space-y-3">
        <form action={formAction} className="space-y-3">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-staff" className="block h-5 leading-5">
                Staff
              </Label>
              <select
                id="schedule-staff"
                name="staff_id"
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-date" className="block h-5 leading-5">
                Date
              </Label>
              <Input
                id="schedule-date"
                type="date"
                required
                value={scheduleDate}
                className="h-9"
                onChange={(e) => setScheduleDate(e.target.value)}
              />
              <input type="hidden" name="day_of_week" value={dayOfWeek} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-opens" className="block h-5 leading-5">
                Opens
              </Label>
              <Input
                key={`start-${timeFieldKey}`}
                id="schedule-opens"
                name="start_time"
                type="time"
                required
                defaultValue={startTime}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-closes" className="block h-5 leading-5">
                Closes
              </Label>
              <Input
                key={`end-${timeFieldKey}`}
                id="schedule-closes"
                name="end_time"
                type="time"
                required
                defaultValue={endTime}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block h-5 leading-5 select-none opacity-0" aria-hidden>
                Save
              </span>
              <Button type="submit" disabled={pending} className="h-9 w-full lg:w-auto lg:min-w-[7.5rem]">
                {pending ? "Saving…" : "Save hours"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Recurring every {DAY_NAMES[dayOfWeek]}
            {existingSchedule ? " · saved hours loaded" : ""}
          </p>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">Schedule saved.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
