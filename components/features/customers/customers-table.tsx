"use client";

import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteCustomer } from "@/lib/actions/customers";
import { formatCustomerName } from "@/lib/format";
import type { Customer } from "@/types";

const PAGE_SIZE = 10;

type CustomersTableProps = {
  customers: Customer[];
  canManage?: boolean;
};

export function CustomersTable({ customers, canManage = false }: CustomersTableProps) {
  const { page, setPage, slice } = usePagination(customers, PAGE_SIZE);

  if (customers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">No customers found.</p>
        <Button className="mt-4" render={<Link href="/customers/new" />}>
          Add your first customer
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="w-[180px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((customer) => {
            const name = formatCustomerName(customer.first_name, customer.last_name);
            return (
              <TableRow key={customer.id} className="group">
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell>{customer.phone ?? "—"}</TableCell>
                <TableCell>{customer.email ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {customer.tags?.length > 0
                      ? customer.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      : "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-primary/20 bg-primary/5 text-primary shadow-sm transition-all hover:border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                      render={<Link href={`/customers/${customer.id}`} />}
                    >
                      <Eye className="size-3.5" />
                      View
                    </Button>
                    {canManage && (
                      <ConfirmAction
                        title="Delete customer?"
                        description={`This will remove ${name} from your customer list.`}
                        confirmLabel="Delete"
                        pendingLabel="Deleting…"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-destructive/25 bg-destructive/5 text-destructive shadow-sm transition-all hover:border-destructive/50 hover:bg-destructive hover:text-destructive-foreground hover:shadow-md"
                        onConfirm={async () => {
                          await deleteCustomer(customer.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </ConfirmAction>
                    )}
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
          total={customers.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
