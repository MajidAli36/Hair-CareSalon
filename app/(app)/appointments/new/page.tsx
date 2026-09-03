import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCustomers } from "@/lib/actions/customers";
import { getServices } from "@/lib/actions/services";
import { getStaff } from "@/lib/actions/staff";
import { AppointmentForm } from "@/components/features/appointments/appointment-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewAppointmentPage() {
  const [customers, staff, services] = await Promise.all([
    getCustomers(),
    getStaff(),
    getServices(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/appointments" />}>
          <ArrowLeft className="size-4" />
          Back to list
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add appointment</h1>
        <p className="text-muted-foreground">
          Book a reception appointment — slots sync with online booking.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Appointment details</CardTitle>
          <CardDescription>Select customer, staff, time slot, and optional advance payment.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentForm customers={customers} staff={staff} services={services} />
        </CardContent>
      </Card>
    </div>
  );
}
