"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchOnlineAppointments,
  type OnlineAppointmentRow,
} from "@/lib/actions/online-booking";
import { AppointmentsScheduleTable } from "@/components/features/appointments/appointments-schedule-table";
import { BookingAdvanceSettings } from "@/components/features/online-booking/booking-advance-settings";
import { StaffOnlineToggle } from "@/components/features/online-booking/staff-online-toggle";
import { StaffScheduleForm } from "@/components/features/staff/staff-schedule-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAY_NAMES } from "@/lib/booking/constants";
import { getLocalDateString, getLocalDayOfWeek } from "@/lib/dates/local";

type StaffRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  online_booking_enabled: boolean;
};

type StaffScheduleRow = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type AdvanceSettings = {
  booking_advance_amount: number;
  booking_advance_percent: number;
  booking_payment_instructions: string | null;
} | null;

type OnlineBookingHubProps = {
  initialDate: string;
  initialAppointments: OnlineAppointmentRow[];
  staff: StaffRow[];
  schedules: StaffScheduleRow[];
  advanceSettings: AdvanceSettings;
  initialPendingCount: number;
  publicUrl: string;
  focus?: "deposits" | null;
};

function syncDateInUrl(date: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("date", date);
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
}

export function OnlineBookingHub({
  initialDate,
  initialAppointments,
  staff: initialStaff,
  schedules,
  advanceSettings,
  initialPendingCount,
  publicUrl,
  focus: initialFocus = null,
}: OnlineBookingHubProps) {
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date");
  const focusFromUrl = searchParams.get("focus") === "deposits" ? "deposits" : null;
  const focus = focusFromUrl ?? initialFocus;

  const [date, setDate] = useState(dateFromUrl || initialDate);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [staff, setStaff] = useState(initialStaff);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [loadingAppointments, startAppointmentTransition] = useTransition();
  const appointmentsSectionRef = useRef<HTMLDivElement>(null);
  const lastLoadedDateRef = useRef(dateFromUrl || initialDate);

  const loadAppointments = useCallback((targetDate: string) => {
    lastLoadedDateRef.current = targetDate;
    startAppointmentTransition(async () => {
      try {
        const rows = await fetchOnlineAppointments(targetDate);
        if (lastLoadedDateRef.current !== targetDate) return;
        setAppointments(rows);
      } catch {
        // Keep current list if fetch fails
      }
    });
  }, []);

  // Notification / soft nav: URL ?date= changed while staying on this page
  useEffect(() => {
    const nextDate = dateFromUrl || initialDate;
    if (!nextDate || nextDate === lastLoadedDateRef.current) return;
    setDate(nextDate);
    loadAppointments(nextDate);
  }, [dateFromUrl, initialDate, loadAppointments]);

  // Server props after router.refresh()
  useEffect(() => {
    setPendingCount(initialPendingCount);
    if (!dateFromUrl || dateFromUrl === initialDate) {
      setAppointments(initialAppointments);
      setDate(initialDate);
      lastLoadedDateRef.current = initialDate;
    }
  }, [initialDate, initialAppointments, initialPendingCount, dateFromUrl]);

  useEffect(() => {
    if (focus !== "deposits") return;
    const node = appointmentsSectionRef.current;
    if (!node) return;
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focus, date]);

  function handleDateChange(newDate: string) {
    if (!newDate || newDate === date) return;
    setDate(newDate);
    syncDateInUrl(newDate);
    loadAppointments(newDate);
  }

  function handleDepositResolved(
    appointmentId: string,
    depositId: string,
    status: "APPROVED" | "REJECTED" | "REFUNDED"
  ) {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id !== appointmentId) return a;
        const deposits = a.deposits.map((d) =>
          d.id === depositId ? { ...d, status } : d
        );
        const nextStatus =
          status === "APPROVED"
            ? "CONFIRMED"
            : status === "REJECTED"
              ? "CANCELLED"
              : status === "REFUNDED" &&
                  advanceSettings &&
                  (advanceSettings.booking_advance_amount > 0 ||
                    advanceSettings.booking_advance_percent > 0)
                ? "SCHEDULED"
                : a.status;
        return { ...a, status: nextStatus, deposits };
      })
    );
    if (status === "APPROVED" || status === "REJECTED") {
      setPendingCount((c) => Math.max(0, c - 1));
    }
  }

  function handleAppointmentCancelled(appointmentId: string) {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId ? { ...a, status: "CANCELLED" } : a
      )
    );
  }

  const todayKey = getLocalDateString();
  const dayOfWeek = useMemo(() => getLocalDayOfWeek(todayKey), [todayKey]);

  const staffForToday = useMemo(() => {
    return staff
      .filter((s) => s.online_booking_enabled)
      .map((s) => {
        const schedule = schedules.find(
          (row) => row.staff_id === s.id && row.day_of_week === dayOfWeek
        );
        return {
          ...s,
          hours: schedule
            ? `${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}`
            : null,
        };
      });
  }, [staff, schedules, dayOfWeek]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Online booking</h1>
          <p className="text-muted-foreground">
            Manage public booking, advance payments, and approve customer deposits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-600">{pendingCount} advance(s) awaiting approval</Badge>
          )}
          <Button variant="outline" render={<Link href={publicUrl} target="_blank" />}>
            Public booking page
          </Button>
          <Button variant="outline" render={<Link href="/" target="_blank" />}>
            Landing page
          </Button>
        </div>
      </div>

      <BookingAdvanceSettings settings={advanceSettings} />

      <Card>
        <CardHeader>
          <CardTitle>Staff on public booking</CardTitle>
          <CardDescription>
            Enable stylists and set weekly hours. Customers only see enabled staff with schedules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffOnlineToggle staff={staff} onStaffChange={setStaff} />
        </CardContent>
      </Card>

      <StaffScheduleForm
        staff={staff.map((s) => ({ id: s.id, full_name: s.full_name }))}
        schedules={schedules}
      />

      <div ref={appointmentsSectionRef} id="online-appointments" className="scroll-mt-24">
        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="appointments">Online appointments</TabsTrigger>
            <TabsTrigger value="staff-today">Staff for today</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Online appointments</CardTitle>
                  <CardDescription>
                    Approve advance payments to confirm bookings. Services fees and balance shown
                    per appointment.
                  </CardDescription>
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ob-date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="ob-date"
                      type="date"
                      value={date}
                      className="h-8 w-40"
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loadingAppointments}
                    onClick={() => loadAppointments(date)}
                  >
                    {loadingAppointments ? "Loading…" : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAppointments ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full rounded-xl" />
                    <Skeleton className="h-28 w-full rounded-xl" />
                  </div>
                ) : (
                  <AppointmentsScheduleTable
                    appointments={appointments}
                    mode="online"
                    advanceSettings={advanceSettings ?? undefined}
                    emptyMessage="No online appointments on this date."
                    onDepositResolved={handleDepositResolved}
                    onAppointmentCancelled={handleAppointmentCancelled}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff-today">
            <Card>
              <CardHeader>
                <CardTitle>Staff for online booking today</CardTitle>
                <CardDescription>
                  Stylists enabled for public booking on {DAY_NAMES[dayOfWeek]} ({todayKey}).
                  Customers only see those with hours set.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {staffForToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No staff enabled for online booking yet. Enable someone above.
                  </p>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Today&apos;s hours</TableHead>
                          <TableHead>Public booking</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffForToday.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.full_name}</TableCell>
                            <TableCell>{s.job_title ?? "—"}</TableCell>
                            <TableCell>
                              {s.hours ? (
                                s.hours
                              ) : (
                                <span className="text-muted-foreground">No hours set</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.hours ? "default" : "secondary"}>
                                {s.hours ? "Bookable today" : "Needs schedule"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
