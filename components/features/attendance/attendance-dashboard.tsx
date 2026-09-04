"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { AttendanceButtons } from "@/components/features/staff/staff-forms";
import { ManualAttendancePanel } from "@/components/features/attendance/manual-attendance-panel";
import { ThumbEnrollmentPanel } from "@/components/features/attendance/thumb-enrollment-panel";
import type { AttendanceOverview, AttendanceReport } from "@/lib/actions/attendance";
import { attendanceMethodLabel } from "@/lib/attendance/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginatedList } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { ExternalLink, Fingerprint, Monitor } from "lucide-react";

type StaffMember = {
  id: string;
  full_name: string;
  thumb_id: string | null;
  thumb_enrolled_at: string | null;
};

type AttendanceDashboardProps = {
  report: AttendanceReport;
  overview: AttendanceOverview;
  staffList: StaffMember[];
  canManage: boolean;
  from: string;
  to: string;
  view: string;
};

function formatDuration(mins: number | null) {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function MethodBadge({ method }: { method: string }) {
  const isThumb = method === "BIOMETRIC";
  return (
    <Badge variant={isThumb ? "default" : "outline"} className={cn(isThumb && "gap-1")}>
      {isThumb && <Fingerprint className="size-3" />}
      {attendanceMethodLabel(method)}
    </Badge>
  );
}

export function AttendanceDashboard({
  report,
  overview,
  staffList,
  canManage,
  from,
  to,
  view,
}: AttendanceDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    startTransition(() => {
      router.push(`/attendance?${params.toString()}`);
    });
  }

  function setPreset(preset: "today" | "week" | "month") {
    const today = new Date();
    const toStr = today.toISOString().slice(0, 10);
    let fromStr = toStr;
    if (preset === "week") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      fromStr = d.toISOString().slice(0, 10);
    } else if (preset === "month") {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      fromStr = d.toISOString().slice(0, 10);
    }
    setParams({ from: fromStr, to: toStr, view: preset === "today" ? "daily" : "range" });
  }

  const thumbScans = report.records.filter((r) => r.method === "BIOMETRIC").length;
  const onDutyIds = useMemo(
    () => new Set(overview.onDuty.map((s) => s.staffId)),
    [overview.onDuty]
  );
  const activeStaff = useMemo(
    () => staffList.map((s) => ({ id: s.id, full_name: s.full_name })),
    [staffList]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="size-5 text-teal-600" />
              Thumb impression attendance
            </CardTitle>
            <CardDescription>
              Primary check-in method — staff scan their thumb on the biometric terminal.{" "}
              {overview.enrolledCount} of {overview.activeStaffCount} stylists enrolled. Enroll
              thumb IDs below, open the kiosk (USB scanners), or use the device agent bridge for SDK
              scanners. Manual check-in is available if the scanner is offline.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button render={<Link href="/kiosk/attendance" target="_blank" />}>
              <Monitor className="mr-2 size-4" />
              Open kiosk display
            </Button>
            {canManage && (
              <Button variant="outline" render={<Link href="/devices" />}>
                <ExternalLink className="mr-2 size-4" />
                Attendance devices
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-[240px]">
          <CardHeader className="pb-2">
            <CardDescription>On duty now</CardDescription>
            <CardTitle className="text-2xl">{overview.onDuty.length}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.onDuty.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody checked in yet.</p>
            ) : (
              <>
                {overview.onDuty.slice(0, 5).map((s) => (
                  <div key={s.staffId} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.staffName}</span>
                    <MethodBadge method={s.method} />
                  </div>
                ))}
                {overview.onDuty.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{overview.onDuty.length - 5} more
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <ManualAttendancePanel staff={activeStaff} onDuty={overview.onDuty} />
      )}

      {canManage && (
        <ThumbEnrollmentPanel
          staff={staffList}
          canManage={canManage}
          enrolledCount={overview.enrolledCount}
        />
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              className={cn(
                p === "today" && from === to && "border-primary bg-accent text-accent-foreground"
              )}
              onClick={() => setPreset(p)}
            >
              {p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              className="h-8 w-36"
              onChange={(e) => setParams({ from: e.target.value, view: "range" })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              className="h-8 w-36"
              onChange={(e) => setParams({ to: e.target.value, view: "range" })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff" className="text-xs">
              Staff
            </Label>
            <select
              id="staff"
              className="flex h-8 rounded-lg border border-input bg-background px-2 text-sm"
              value={searchParams.get("staff") ?? ""}
              onChange={(e) => setParams({ staff: e.target.value })}
            >
              <option value="">All staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Sessions", value: report.stats.totalSessions },
          { label: "Thumb scans", value: thumbScans },
          { label: "Completed", value: report.stats.completedSessions },
          { label: "Still on duty", value: report.stats.openSessions },
          { label: "Staff-days", value: report.stats.uniqueStaffDays },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {view !== "daily" && report.summaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff summary</CardTitle>
            <CardDescription>Working days and hours for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <PaginatedList items={report.summaries}>
              {(slice) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Working days</TableHead>
                      <TableHead>Total hours</TableHead>
                      <TableHead>Avg / day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((s) => (
                      <TableRow key={s.staffId}>
                        <TableCell className="font-medium">{s.staffName}</TableCell>
                        <TableCell>{s.sessions}</TableCell>
                        <TableCell>{s.workingDays}</TableCell>
                        <TableCell>{s.totalHours}h</TableCell>
                        <TableCell>{s.avgHoursPerDay}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </PaginatedList>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance log</CardTitle>
          <CardDescription>{from === to ? from : `${from} → ${to}`}</CardDescription>
        </CardHeader>
        <CardContent>
          <PaginatedList
            items={report.records}
            empty={
              <p className="text-sm text-muted-foreground">No attendance records for this period.</p>
            }
          >
            {(slice) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Check in</TableHead>
                    <TableHead>Check out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Method</TableHead>
                    {canManage && <TableHead>Manual</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slice.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.staff?.full_name ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(a.check_in_at)}</TableCell>
                      <TableCell>
                        {a.check_out_at ? (
                          formatDateTime(a.check_out_at)
                        ) : (
                          <Badge variant="secondary">On duty</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(a.durationMinutes)}</TableCell>
                      <TableCell>
                        <MethodBadge method={a.method} />
                      </TableCell>
                      {canManage && a.staff && (
                        <TableCell>
                          <AttendanceButtons
                            staffId={a.staff.id}
                            onDuty={!a.check_out_at || onDutyIds.has(a.staff.id)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PaginatedList>
        </CardContent>
      </Card>
    </div>
  );
}
