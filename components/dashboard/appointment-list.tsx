import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import type { DashboardAppointment } from "@/lib/actions/dashboard";
import { formatTime } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-muted text-muted-foreground" },
  CONFIRMED: { label: "Confirmed", className: "bg-accent text-accent-foreground" },
  CHECKED_IN: { label: "Checked in", className: "bg-primary/10 text-primary" },
  IN_PROGRESS: { label: "In progress", className: "bg-primary/10 text-primary" },
  COMPLETED: { label: "Completed", className: "bg-[#16a34a]/10 text-[#16a34a]" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  NO_SHOW: { label: "No show", className: "bg-destructive/10 text-destructive" },
};

type AppointmentListProps = {
  appointments: DashboardAppointment[];
};

export function AppointmentList({ appointments }: AppointmentListProps) {
  return (
    <div className="dashboard-card flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Today&apos;s Appointments</h3>
          <p className="text-xs text-muted-foreground">{appointments.length} scheduled</p>
        </div>
        <Button variant="ghost" size="sm" render={<Link href="/appointments" />}>
          View all
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Calendar className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No appointments today</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Your schedule is clear. Create an appointment to get started.
          </p>
          <Button className="mt-4" size="sm" render={<Link href="/appointments/new" />}>
            New Appointment
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {appointments.map((appt) => {
            const status = statusStyles[appt.status] ?? statusStyles.SCHEDULED;
            return (
              <li
                key={appt.id}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
              >
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                    {getInitials(appt.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{appt.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appt.serviceName}
                    {appt.staffName ? ` · ${appt.staffName}` : ""}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs font-medium text-foreground">{formatTime(appt.scheduledAt)}</p>
                </div>
                <Badge variant="secondary" className={cn("shrink-0 text-[10px]", status.className)}>
                  {status.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
