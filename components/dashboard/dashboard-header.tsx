import Link from "next/link";
import { Calendar, Plus, ShoppingCart } from "lucide-react";
import { formatDate, getGreeting } from "@/lib/format";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  organizationName?: string;
  userEmail?: string;
};

export function DashboardHeader({ organizationName, userEmail }: DashboardHeaderProps) {
  const today = new Date();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {getGreeting(userEmail)} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at{" "}
          <span className="font-medium text-foreground">{organizationName ?? "your salon"}</span>{" "}
          today.
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(today, "weekday")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" render={<Link href="/appointments/new" />}>
          <Calendar className="size-4" />
          New Appointment
        </Button>
        <Button size="sm" render={<Link href="/pos" />}>
          <Plus className="size-4" />
          New Sale
        </Button>
        <Button variant="secondary" size="sm" className="hidden sm:inline-flex" render={<Link href="/pos" />}>
          <ShoppingCart className="size-4" />
          Open POS
        </Button>
      </div>
    </div>
  );
}
