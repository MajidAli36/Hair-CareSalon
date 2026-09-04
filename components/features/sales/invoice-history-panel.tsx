"use client";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type VersionRow = {
  id: string;
  version_number: number;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  change_reason: string | null;
  changed_at: string;
  status: string;
  items?: {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    item_type: string;
  }[];
};

type RefundRow = {
  id: string;
  amount: number;
  method: string;
  reason: string;
  created_at: string;
};

export function InvoiceHistoryPanel({
  versions,
  refunds,
}: {
  versions: VersionRow[];
  refunds: RefundRow[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!versions.length ? (
            <p className="text-sm text-muted-foreground">
              No amendment snapshots yet. Version 1 is created on the first amendment.
            </p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-lg border border-border/80 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{v.version_number}</Badge>
                    <span className="text-sm font-medium">{formatCurrency(v.total)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(v.changed_at)}
                  </span>
                </div>
                {v.change_reason ? (
                  <p className="mb-2 text-xs text-muted-foreground">{v.change_reason}</p>
                ) : null}
                {(v.items?.length ?? 0) > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {v.items!.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.line_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Refund history</CardTitle>
        </CardHeader>
        <CardContent>
          {!refunds.length ? (
            <p className="text-sm text-muted-foreground">No refunds recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {refunds.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 border-b border-border/60 py-2">
                  <div>
                    <p className="font-medium">{formatCurrency(r.amount)} · {r.method}</p>
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
