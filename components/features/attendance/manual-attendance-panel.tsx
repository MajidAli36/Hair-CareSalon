"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordManualAttendance } from "@/lib/actions/staff";
import { attendanceMethodLabel } from "@/lib/attendance/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatTime } from "@/lib/format";
import { getLocalDateString, getLocalTimeString, pakistanDateTimeToIso } from "@/lib/dates/local";
import { cn } from "@/lib/utils";
import { Clock, LogIn, LogOut } from "lucide-react";

type StaffMember = {
  id: string;
  full_name: string;
};

type OnDutyRow = {
  staffId: string;
  staffName: string;
  method: string;
  since: string;
};

type ManualAttendancePanelProps = {
  staff: StaffMember[];
  onDuty: OnDutyRow[];
};

/** Pakistan datetime-local value for an input (yyyy-MM-ddTHH:mm). */
function toLocalInputValue(date = new Date()) {
  return `${getLocalDateString(date)}T${getLocalTimeString(date)}`;
}

function localInputToIso(value: string) {
  if (!value.trim()) return null;
  const [dateStr, timeStr] = value.split("T");
  if (!dateStr || !timeStr) return null;
  try {
    return pakistanDateTimeToIso(dateStr, timeStr.slice(0, 5));
  } catch {
    return null;
  }
}

export function ManualAttendancePanel({ staff, onDuty }: ManualAttendancePanelProps) {
  const router = useRouter();
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [atLocal, setAtLocal] = useState(toLocalInputValue);
  const [pastShift, setPastShift] = useState(false);
  const [checkInLocal, setCheckInLocal] = useState(toLocalInputValue);
  const [checkOutLocal, setCheckOutLocal] = useState(toLocalInputValue);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();
  const [rowPending, setRowPending] = useState<string | null>(null);

  const onDutyById = useMemo(() => {
    const map = new Map<string, OnDutyRow>();
    for (const row of onDuty) map.set(row.staffId, row);
    return map;
  }, [onDuty]);

  const selected = staff.find((s) => s.id === staffId) ?? null;
  const selectedDuty = selected ? onDutyById.get(selected.id) : undefined;
  const isOnDuty = Boolean(selectedDuty);

  function runAction(id: string, action: "in" | "out", name: string, withTime = false) {
    setMessage(null);
    setRowPending(id);
    const at =
      withTime && useCustomTime && !pastShift ? localInputToIso(atLocal) : null;
    startTransition(async () => {
      const result = await recordManualAttendance(id, action, { at });
      setRowPending(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      const when = at ? ` at ${formatDateTime(at)}` : "";
      setMessage({
        type: "success",
        text:
          action === "in" ? `${name} checked in${when}` : `${name} checked out${when}`,
      });
      router.refresh();
    });
  }

  function runPastShift() {
    if (!selected) return;
    setMessage(null);
    setRowPending(selected.id);
    const checkInAt = localInputToIso(checkInLocal);
    const checkOutAt = localInputToIso(checkOutLocal);
    if (!checkInAt || !checkOutAt) {
      setMessage({ type: "error", text: "Enter both check-in and check-out times" });
      setRowPending(null);
      return;
    }
    startTransition(async () => {
      const result = await recordManualAttendance(selected.id, "session", {
        checkInAt,
        checkOutAt,
      });
      setRowPending(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({
        type: "success",
        text: `${selected.full_name} shift saved (${formatDateTime(checkInAt)} → ${formatDateTime(checkOutAt)})`,
      });
      setPastShift(false);
      router.refresh();
    });
  }

  if (staff.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Manual check-in
          </CardTitle>
          <CardDescription>Add staff profiles first to record attendance manually.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5" />
          Manual check-in
        </CardTitle>
        <CardDescription>
          Use when the thumb scanner, power, or internet was down. You can set the real arrival or
          leaving time (up to 7 days back). Marked as Manual in the log.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="manual-staff" className="block h-5 leading-5">
                Staff member
              </Label>
              <select
                id="manual-staff"
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setMessage(null);
                }}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {onDutyById.has(s.id) ? " · on duty" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-at" className="block h-5 leading-5">
                Actual time
              </Label>
              <div className="flex h-9 items-center gap-2">
                <label
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs",
                    useCustomTime && !pastShift
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-input bg-background text-muted-foreground",
                    pastShift && "opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={useCustomTime && !pastShift}
                    disabled={pastShift}
                    onChange={(e) => {
                      setUseCustomTime(e.target.checked);
                      if (e.target.checked) setAtLocal(toLocalInputValue());
                      setMessage(null);
                    }}
                  />
                  Set
                </label>
                <Input
                  id="manual-at"
                  type="datetime-local"
                  value={atLocal}
                  disabled={!useCustomTime || pastShift}
                  onChange={(e) => setAtLocal(e.target.value)}
                  className="h-9 min-w-0 flex-1"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <span className="block h-5 leading-5 text-sm font-medium opacity-0 select-none lg:block" aria-hidden>
                Actions
              </span>
              <div className="flex h-9 items-center gap-2">
                <Button
                  type="button"
                  className="h-9"
                  disabled={pending || !selected || isOnDuty || pastShift}
                  onClick={() =>
                    selected && runAction(selected.id, "in", selected.full_name, true)
                  }
                >
                  <LogIn className="mr-2 size-4" />
                  Check in
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  disabled={pending || !selected || !isOnDuty || pastShift}
                  onClick={() =>
                    selected && runAction(selected.id, "out", selected.full_name, true)
                  }
                >
                  <LogOut className="mr-2 size-4" />
                  Check out
                </Button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {useCustomTime && !pastShift
              ? "Custom time is applied on Check in / Check out (for outages)."
              : "Turn on Set to choose a time; leave off to use now."}
          </p>

          <div className="space-y-3 border-t pt-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={pastShift}
                disabled={isOnDuty}
                onChange={(e) => {
                  setPastShift(e.target.checked);
                  if (e.target.checked) {
                    setUseCustomTime(false);
                    const now = new Date();
                    const earlier = new Date(now.getTime() - 8 * 60 * 60 * 1000);
                    setCheckInLocal(toLocalInputValue(earlier));
                    setCheckOutLocal(toLocalInputValue(now));
                  }
                  setMessage(null);
                }}
              />
              <span>
                <span className="font-medium">Record a completed past shift</span>
                <span className="block text-xs text-muted-foreground">
                  Both in and out times — for when power/internet was down and the stylist already
                  left. Disabled while they are still on duty.
                </span>
              </span>
            </label>

            {pastShift && (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="past-in">Check-in time</Label>
                  <Input
                    id="past-in"
                    type="datetime-local"
                    value={checkInLocal}
                    onChange={(e) => setCheckInLocal(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="past-out">Check-out time</Label>
                  <Input
                    id="past-out"
                    type="datetime-local"
                    value={checkOutLocal}
                    onChange={(e) => setCheckOutLocal(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  disabled={pending || !selected}
                  onClick={runPastShift}
                >
                  Save shift
                </Button>
              </div>
            )}
          </div>

          {selected && (
            <p className="text-sm text-muted-foreground">
              {isOnDuty && selectedDuty ? (
                <>
                  <Badge variant="secondary" className="mr-2">
                    On duty
                  </Badge>
                  since {formatDateTime(selectedDuty.since)} via{" "}
                  {attendanceMethodLabel(selectedDuty.method)}
                </>
              ) : (
                <>Currently off duty — ready to check in.</>
              )}
            </p>
          )}

          {message && (
            <p
              className={cn(
                "text-sm",
                message.type === "error" ? "text-destructive" : "text-green-600"
              )}
            >
              {message.text}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Quick roster</p>
          <p className="text-xs text-muted-foreground">Uses current time only. For backdating, use the form above.</p>
          <ul className="divide-y rounded-lg border">
            {staff.map((s) => {
              const duty = onDutyById.get(s.id);
              const busy = pending && rowPending === s.id;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {duty
                        ? `On duty since ${formatTime(duty.since)} · ${attendanceMethodLabel(duty.method)}`
                        : "Off duty"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || pending || Boolean(duty)}
                      onClick={() => runAction(s.id, "in", s.full_name, false)}
                    >
                      In
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || pending || !duty}
                      onClick={() => runAction(s.id, "out", s.full_name, false)}
                    >
                      Out
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
