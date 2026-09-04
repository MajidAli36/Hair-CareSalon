import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/actions/customers";
import { getCustomerStatement } from "@/lib/actions/payments";
import { canManageRecords } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { formatCurrency, formatCustomerName, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerStatementControls } from "@/components/features/customers/customer-statement-controls";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function CustomerStatementPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const canManage = await canManageRecords();
  if (!canManage) redirect(`/customers/${id}`);

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const statement = await getCustomerStatement(id, from, to);
  const name = formatCustomerName(customer.first_name, customer.last_name);

  const csv = [
    ["Date", "Reference", "Description", "Debit", "Credit", "Balance"],
    ...statement.lines.map((l) => [
      l.date,
      l.reference,
      l.description,
      String(l.debit),
      String(l.credit),
      String(l.balance),
    ]),
  ]
    .map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer statement</h1>
          <p className="text-muted-foreground">{name}</p>
        </div>
        <div className="flex gap-2">
          <CustomerStatementControls csv={csv} filename={`${name.replace(/\s+/g, "-")}-statement.csv`} />
          <Button variant="outline" render={<Link href={`/customers/${id}`} />}>
            Back
          </Button>
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle className="text-base">
            {name}
            {from || to ? ` · ${from ?? "…"} → ${to ?? "…"}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <p>
              <span className="text-muted-foreground">Opening balance: </span>
              {formatCurrency(statement.openingBalance)}
            </p>
            <p>
              <span className="text-muted-foreground">Closing balance: </span>
              <span className="font-semibold">{formatCurrency(statement.closingBalance)}</span>
            </p>
          </div>
          {statement.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.lines.map((line, i) => (
                  <TableRow key={`${line.date}-${i}`}>
                    <TableCell>{formatDateTime(line.date)}</TableCell>
                    <TableCell>{line.reference}</TableCell>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right">
                      {line.debit ? formatCurrency(line.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.credit ? formatCurrency(line.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.balance)}
                    </TableCell>
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
