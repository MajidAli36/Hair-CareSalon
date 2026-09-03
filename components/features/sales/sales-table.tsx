"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCustomerName, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 10;

type SaleRow = {
  id: string;
  total: number;
  status: string;
  completed_at: string | null;
  created_at: string;
  customer: { first_name: string; last_name: string | null } | null;
  invoice: { invoice_number: string }[] | { invoice_number: string } | null;
};

export function SalesTable({ sales }: { sales: SaleRow[] }) {
  const { page, setPage, slice } = usePagination(sales, PAGE_SIZE);

  if (sales.length === 0) {
    return <p className="text-sm text-muted-foreground">No sales yet. Start from POS.</p>;
  }

  return (
    <div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((sale) => {
              const invoice = sale.invoice;
              const invoiceNum = Array.isArray(invoice)
                ? invoice[0]?.invoice_number
                : invoice?.invoice_number;
              const when = sale.completed_at ?? sale.created_at;
              return (
                <TableRow key={sale.id} className="group">
                  <TableCell className="font-medium">{invoiceNum ?? "—"}</TableCell>
                  <TableCell>
                    {sale.customer
                      ? formatCustomerName(sale.customer.first_name, sale.customer.last_name)
                      : "Walk-in"}
                  </TableCell>
                  <TableCell>{formatCurrency(sale.total)}</TableCell>
                  <TableCell>
                    <Badge variant={sale.status === "COMPLETED" ? "default" : "secondary"}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(when)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-primary/20 bg-primary/5 text-primary shadow-sm transition-all hover:border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                        render={<Link href={`/sales/${sale.id}`} />}
                      >
                        <Eye className="size-3.5" />
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="px-3 pb-3">
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={sales.length}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}

export function SalesTableCard({ sales }: { sales: SaleRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All sales</CardTitle>
      </CardHeader>
      <CardContent>
        <SalesTable sales={sales} />
      </CardContent>
    </Card>
  );
}
