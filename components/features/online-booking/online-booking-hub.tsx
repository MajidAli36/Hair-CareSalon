"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
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
import { getLocalDateString } from "@/lib/dates/local";

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
}: OnlineBookingHubProps) {
  const [date, setDate] = useState(initialDate);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [staff, setStaff] = useState(initialStaff);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [loadingAppointments, startAppointmentTransition] = useTransition();

  const loadAppointments = useCallback((targetDate: string) => {
    startAppointmentTransition(async () => {
      const rows = await fetchOnlineAppointments(targetDate);
      setAppointments(rows);
    });
  }, []);

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

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Online appointments</CardTitle>
            <CardDescription>
              Approve advance payments to confirm bookings. Services fees and balance shown per
              appointment.
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
                max={getLocalDateString()}
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
    </div>
  );
}
