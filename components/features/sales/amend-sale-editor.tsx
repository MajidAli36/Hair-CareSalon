"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { amendCompletedSale } from "@/lib/actions/sales-lifecycle";
import {
  calculateInvoiceTotals,
  calculatePaymentAdjustment,
} from "@/lib/sales/calculate";
import type { PaymentMethod, SaleItemType } from "@/types/commerce";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CatalogItem = {
  id: string;
  name: string;
  price: number;
  itemType: SaleItemType;
};

type Line = {
  key: string;
  itemType: SaleItemType;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type AmendSaleEditorProps = {
  saleId: string;
  currentVersion: number;
  oldTotal: number;
  paymentsTotal: number;
  refundsTotal: number;
  customerId: string | null;
  discount: number;
  tax: number;
  notes: string | null;
  initialLines: Line[];
  catalog: CatalogItem[];
  customers: { id: string; label: string }[];
};

export function AmendSaleEditor({
  saleId,
  currentVersion,
  oldTotal,
  paymentsTotal,
  refundsTotal,
  customerId: initialCustomerId,
  discount: initialDiscount,
  tax: initialTax,
  notes: initialNotes,
  initialLines,
  catalog,
  customers,
}: AmendSaleEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [discount, setDiscount] = useState(initialDiscount);
  const [tax, setTax] = useState(initialTax);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [reason, setReason] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [settleAdditionalNow, setSettleAdditionalNow] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addKey, setAddKey] = useState("");

  const totals = useMemo(
    () =>
      calculateInvoiceTotals(
        lines.map((l) => ({
          itemType: l.itemType,
          itemId: l.itemId,
          name: l.name,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
        discount,
        tax
      ),
    [lines, discount, tax]
  );

  const adjustment = useMemo(
    () =>
      calculatePaymentAdjustment({
        oldTotal,
        newTotal: totals.total,
        paymentsTotal,
        refundsTotal,
      }),
    [oldTotal, totals.total, paymentsTotal, refundsTotal]
  );

  function addCatalogItem() {
    const item = catalog.find((c) => `${c.itemType}:${c.id}` === addKey);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${item.itemType}-${item.id}-${Date.now()}`,
        itemType: item.itemType,
        itemId: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: 1,
      },
    ]);
    setAddKey("");
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="space-y-2 pt-4 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-semibold">Amending a completed invoice</p>
          <p>
            Changes may affect revenue, inventory, payments, customer history, staff performance
            and profit. A new version will be saved; the previous version is preserved for audit.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Walk-in</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                  value={addKey}
                  onChange={(e) => setAddKey(e.target.value)}
                >
                  <option value="">Add service / product / package…</option>
                  {catalog.map((c) => (
                    <option key={`${c.itemType}-${c.id}`} value={`${c.itemType}:${c.id}`}>
                      [{c.itemType}] {c.name} — {formatCurrency(c.price)}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={addCatalogItem} disabled={!addKey}>
                  Add
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-28">Price</TableHead>
                    <TableHead className="text-right">Line</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell>
                        <div className="font-medium">{line.name}</div>
                        <div className="text-xs text-muted-foreground">{line.itemType}</div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="h-8"
                          value={line.quantity}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) }
                                  : l
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8"
                          value={line.unitPrice}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, unitPrice: Math.max(0, Number(e.target.value) || 0) }
                                  : l
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.unitPrice * line.quantity)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discount / tax / notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Discount</Label>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-1">
                <Label>Tax</Label>
                <Input
                  type="number"
                  min={0}
                  value={tax}
                  onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>−{formatCurrency(totals.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(totals.tax)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>New total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Old total</span>
                <span>{formatCurrency(adjustment.oldTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>New total</span>
                <span>{formatCurrency(adjustment.newTotal)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Difference</span>
                <span className={adjustment.difference < 0 ? "text-destructive" : ""}>
                  {formatCurrency(adjustment.difference)}
                </span>
              </div>
              {adjustment.additionalDue > 0 ? (
                <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                  <p>
                    New outstanding due: {formatCurrency(adjustment.additionalDue)}
                    {" "}(paid {formatCurrency(adjustment.netCollected)} vs new total{" "}
                    {formatCurrency(adjustment.newTotal)})
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={settleAdditionalNow}
                      onChange={(e) => setSettleAdditionalNow(e.target.checked)}
                    />
                    <span>Collect additional {formatCurrency(adjustment.additionalDue)} now</span>
                  </label>
                </div>
              ) : null}
              {adjustment.refundDue > 0 ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                  Action required: refund {formatCurrency(adjustment.refundDue)} (paid exceeds new
                  total)
                </p>
              ) : null}
              {((adjustment.additionalDue > 0 && settleAdditionalNow) ||
                adjustment.refundDue > 0) && (
                <div className="space-y-1 pt-1">
                  <Label>Payment method</Label>
                  <select
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authorization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="change-reason">Change reason (required)</Label>
                <Textarea
                  id="change-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why this invoice is being amended"
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  This invoice has already been completed. Changes may affect revenue,
                  inventory, payments, customer history, staff performance and profit.
                </span>
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => router.push(`/sales/${saleId}`)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={pending || !confirmed || reason.trim().length < 3 || !lines.length}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const res = await amendCompletedSale({
                        saleId,
                        expectedVersion: currentVersion,
                        customerId: customerId || null,
                        items: totals.lines.map((l) => ({
                          itemType: l.itemType,
                          itemId: l.itemId,
                          name: l.name,
                          unitPrice: l.unitPrice,
                          quantity: l.quantity,
                        })),
                        discount: totals.discount,
                        tax: totals.tax,
                        notes,
                        changeReason: reason,
                        settleAdditionalNow,
                        additionalPayment:
                          adjustment.additionalDue > 0 && settleAdditionalNow
                            ? { amount: adjustment.additionalDue, method: payMethod }
                            : null,
                        refundPayment:
                          adjustment.refundDue > 0
                            ? { amount: adjustment.refundDue, method: payMethod }
                            : null,
                      });
                      if (res.error) {
                        setError(res.error);
                        return;
                      }
                      router.push(`/sales/${saleId}?tab=history`);
                      router.refresh();
                    })
                  }
                >
                  {pending ? "Saving…" : "Save amendment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
