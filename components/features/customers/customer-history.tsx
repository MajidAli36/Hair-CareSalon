import Link from "next/link";
import type { CustomerHistory } from "@/lib/actions/customers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CustomerHistoryPanelProps = {
  history: CustomerHistory;
};

export function CustomerHistoryPanel({ history }: CustomerHistoryPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total spent</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(history.stats.totalSpent)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed sales</CardDescription>
            <CardTitle className="text-2xl">{history.stats.visitCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Appointments</CardDescription>
            <CardTitle className="text-2xl">{history.stats.appointmentCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales history</CardTitle>
          <CardDescription>All purchases linked to this customer</CardDescription>
        </CardHeader>
        <CardContent>
          {history.sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.sales.map((sale) => {
                  const inv = Array.isArray(sale.invoice) ? sale.invoice[0] : sale.invoice;
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {sale.completed_at
                          ? formatDate(sale.completed_at)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/sales/${sale.id}`} className="text-primary hover:underline">
                          {inv?.invoice_number ?? sale.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {sale.items?.map((i) => i.name).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.status === "COMPLETED" ? "default" : "secondary"}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.appointments.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell>{formatDateTime(appt.scheduled_at)}</TableCell>
                    <TableCell>
                      {appt.services?.map((s) => s.service_name).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{appt.staff?.full_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{appt.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp messages</CardTitle>
        </CardHeader>
        <CardContent>
          {history.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages logged.</p>
          ) : (
            <ul className="space-y-3">
              {history.messages.map((msg) => (
                <li key={msg.id} className="rounded-lg border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant={msg.direction === "INBOUND" ? "default" : "secondary"}>
                      {msg.direction}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  <p>{msg.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{msg.status}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
