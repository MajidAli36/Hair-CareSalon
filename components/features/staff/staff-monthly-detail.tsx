"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { StaffMonthlyDetail } from "@/lib/actions/reports";
import { createStaffNote, deleteStaffNote } from "@/lib/actions/staff-notes";
import type { ActionResult } from "@/types/commerce";
import { formatCurrency, formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { getLocalDateString } from "@/lib/dates/local";
import { attendanceMethodLabel } from "@/lib/attendance/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-PK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function noteTypeLabel(type: string) {
  switch (type) {
    case "WARNING":
      return "Warning";
    case "COMPLAINT":
      return "Complaint";
    case "PRAISE":
      return "Praise";
    default:
      return "Note";
  }
}

function noteBadgeVariant(
  type: string
): "default" | "secondary" | "outline" | "destructive" {
  if (type === "COMPLAINT") return "destructive";
  if (type === "WARNING") return "outline";
  if (type === "PRAISE") return "default";
  return "secondary";
}

function AddConductForm({
  staffId,
  yearMonth,
  defaultDate,
}: {
  staffId: string;
  yearMonth: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStaffNote, {} as ActionResult);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="year_month" value={yearMonth} />
      <p className="text-sm font-medium">Add warning, complaint, or praise</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="note_type">Type</Label>
          <select
            id="note_type"
            name="note_type"
            required
            className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            defaultValue="WARNING"
          >
            <option value="WARNING">Warning</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="PRAISE">Praise</option>
            <option value="NOTE">General note</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="severity">Severity</Label>
          <select
            id="severity"
            name="severity"
            className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            defaultValue="1"
          >
            <option value="1">Low</option>
            <option value="2">Medium</option>
            <option value="3">High</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required maxLength={120} placeholder="Short summary" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="occurred_on">Date</Label>
          <Input id="occurred_on" name="occurred_on" type="date" defaultValue={defaultDate} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="details">Details</Label>
          <textarea
            id="details"
            name="details"
            rows={3}
            maxLength={2000}
            placeholder="What happened, customer feedback, follow-up…"
            className="flex w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save entry"}
      </Button>
    </form>
  );
}

export function StaffMonthlyDetailView({
  data,
  canManage = false,
}: {
  data: StaffMonthlyDetail;
  canManage?: boolean;
}) {
  const router = useRouter();
  const prev = shiftMonth(data.yearMonth, -1);
  const next = shiftMonth(data.yearMonth, 1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const attendanceHref = `/attendance?from=${data.from}&to=${data.to}&staff=${data.staffId}`;
  const defaultNoteDate =
    data.from <= getLocalDateString() && getLocalDateString() <= data.to
      ? getLocalDateString()
      : data.from;

  async function onDeleteNote(noteId: string) {
    setDeletingId(noteId);
    const result = await deleteStaffNote(noteId, data.staffId);
    setDeletingId(null);
    if (!result.error) router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/staff" className="hover:underline">
              Staff
            </Link>
            {" / "}
            Monthly detail
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground">{monthLabel(data.yearMonth)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/staff/${data.staffId}?month=${prev}`)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/staff/${data.staffId}?month=${next}`)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue (equal share)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(data.revenue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.salesCount} sale{data.salesCount === 1 ? "" : "s"} linked
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customers served</CardDescription>
            <CardTitle className="text-2xl">{data.customersServed}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Unique customers on linked sales
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Appointments</CardDescription>
            <CardTitle className="text-2xl">
              {data.completed}/{data.appointments}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Done / booked · {data.completionRate.toFixed(0)}% completion
            {(data.cancelled > 0 || data.noShow > 0) && (
              <span>
                {" "}
                · {data.cancelled} cancelled · {data.noShow} no-show
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Days present</CardDescription>
            <CardTitle className="text-2xl">{data.attendance.workingDays}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.attendance.sessions} check-in
            {data.attendance.sessions === 1 ? "" : "s"}
            {data.attendance.openSessions > 0
              ? ` · ${data.attendance.openSessions} still open`
              : ""}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg duty / session</CardDescription>
            <CardTitle className="text-2xl">
              {data.attendance.completedSessions > 0
                ? formatDuration(data.attendance.avgDutyMinutes)
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.attendance.workingDays > 0
              ? `${formatDuration(data.attendance.avgDutyMinutesPerDay)} avg / day · `
              : ""}
            Total{" "}
            {data.attendance.totalDutyMinutes > 0
              ? formatDuration(data.attendance.totalDutyMinutes)
              : "0 min"}{" "}
            this month
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Professional behaviour</CardDescription>
            <CardTitle className="text-2xl">{data.conduct.score}/100</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.conduct.label}
            {" · "}
            {data.conduct.warnings} warning{data.conduct.warnings === 1 ? "" : "s"}
            {" · "}
            {data.conduct.complaints} complaint
            {data.conduct.complaints === 1 ? "" : "s"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Attendance & duty</CardTitle>
            <CardDescription>
              Linked from Attendance · {formatDate(data.from)} – {formatDate(data.to)}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            render={<Link href={attendanceHref} />}
          >
            Open attendance
            <ExternalLink className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Working days</p>
              <p className="text-lg font-semibold">{data.attendance.workingDays}</p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Avg / session</p>
              <p className="text-lg font-semibold">
                {data.attendance.completedSessions > 0
                  ? formatDuration(data.attendance.avgDutyMinutes)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Avg / day</p>
              <p className="text-lg font-semibold">
                {data.attendance.workingDays > 0
                  ? formatDuration(data.attendance.avgDutyMinutesPerDay)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Total duty</p>
              <p className="text-lg font-semibold">
                {data.attendance.totalDutyHours > 0
                  ? `${data.attendance.totalDutyHours}h`
                  : "0h"}
              </p>
            </div>
          </div>

          {!data.attendance.recentSessions.length ? (
            <p className="text-sm text-muted-foreground">
              No attendance sessions this month. Record check-ins on the Attendance page.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Duty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attendance.recentSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(s.checkInAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {s.checkOutAt ? formatDateTime(s.checkOutAt) : "Still on duty"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{attendanceMethodLabel(s.method)}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {s.durationMinutes != null ? formatDuration(s.durationMinutes) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warnings, complaints & behaviour</CardTitle>
          <CardDescription>
            Conduct score starts at 100. Warnings and complaints reduce it; praise increases it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Score</p>
              <p className="text-lg font-semibold">
                {data.conduct.score} · {data.conduct.label}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Warnings</p>
              <p className="text-lg font-semibold">{data.conduct.warnings}</p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Complaints</p>
              <p className="text-lg font-semibold">{data.conduct.complaints}</p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Praise</p>
              <p className="text-lg font-semibold">{data.conduct.praise}</p>
            </div>
          </div>

          {canManage && (
            <AddConductForm
              staffId={data.staffId}
              yearMonth={data.yearMonth}
              defaultDate={defaultNoteDate}
            />
          )}

          {!data.conduct.entries.length ? (
            <p className="text-sm text-muted-foreground">
              No warnings, complaints, praise, or notes recorded this month.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Details</TableHead>
                  {canManage && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.conduct.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(e.occurredOn)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={noteBadgeVariant(e.noteType)}>
                        {noteTypeLabel(e.noteType)}
                        {e.severity > 1 ? ` · ${e.severity}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                      {e.details ?? "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === e.id}
                          onClick={() => onDeleteNote(e.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments this month</CardTitle>
          <CardDescription>
            From Finances · {formatDate(data.from)} – {formatDate(data.to)} ·{" "}
            {formatCurrency(data.paymentsTotal)} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data.payments.length ? (
            <p className="text-sm text-muted-foreground">No staff payments recorded this month.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
                    <TableCell>{p.paymentType}</TableCell>
                    <TableCell className="text-muted-foreground">{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
