import Link from "next/link";
import { redirect } from "next/navigation";
import { createCustomer } from "@/lib/actions/customers";
import { canManageRecords } from "@/lib/auth/permissions";
import { CustomerForm } from "@/components/features/customers/customer-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewCustomerPage() {
  const canManage = await canManageRecords();
  if (!canManage) redirect("/customers");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New customer</h1>
          <p className="text-muted-foreground">Add a new customer record.</p>
        </div>
        <Button variant="outline" render={<Link href="/customers" />}>
          Cancel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
          <CardDescription>
            Phone or email helps you find customers quickly at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm action={createCustomer} submitLabel="Create customer" />
        </CardContent>
      </Card>
    </div>
  );
}
