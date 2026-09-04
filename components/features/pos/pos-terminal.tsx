"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeCheckout } from "@/lib/actions/sales";
import { getCustomerAdvanceAppointments, type PosAppointment } from "@/lib/actions/appointments";
import { printSaleReceipt } from "@/components/features/sales/print-receipt-button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCustomerName, formatDate, formatTime } from "@/lib/format";
import type { CartItem, PaymentMethod } from "@/types/commerce";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type CatalogService = { id: string; name: string; price: number; duration_minutes: number };
type CatalogProduct = { id: string; name: string; retail_price: number; stock_quantity: number };
type CatalogPackage = { id: string; name: string; price: number };
type CatalogCustomer = { id: string; first_name: string; last_name: string | null; phone: string | null };
type CatalogStaff = { id: string; full_name: string };

type PosTerminalProps = {
  services: CatalogService[];
  products: CatalogProduct[];
  packages: CatalogPackage[];
  customers: CatalogCustomer[];
  staff: CatalogStaff[];
  appointments: PosAppointment[];
  canManage?: boolean;
};

function formatApptLabel(a: PosAppointment) {
  const date = new Date(a.scheduledAt);
  const isToday = date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  const time = formatTime(date);
  const day = isToday ? time : `${formatDate(date)} ${time}`;
  const advance = a.depositBalance > 0 ? ` · ${formatCurrency(a.depositBalance)} advance` : "";
  return `${day} — ${a.customerName}${advance}`;
}

export function PosTerminal({
  services,
  products,
  packages,
  customers,
  staff,
  appointments,
  canManage = false,
}: PosTerminalProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [depositCredit, setDepositCredit] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState("");
  const [applyTax, setApplyTax] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [tenderedAmount, setTenderedAmount] = useState<string>("");
  const [confirmPartial, setConfirmPartial] = useState(false);
  const [allowUnpaid, setAllowUnpaid] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customerLookupPending, startCustomerLookup] = useTransition();

  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === appointmentId) ?? null,
    [appointments, appointmentId]
  );

  const appointmentsWithAdvance = useMemo(
    () => appointments.filter((a) => a.depositBalance > 0),
    [appointments]
  );

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountAmount = Math.min(Math.max(0, discount), subtotal);
  const taxAmount = applyTax ? Math.max(0, Number(tax) || 0) : 0;
  const total = Math.max(0, subtotal - discountAmount + taxAmount);
  const appliedDeposit = Math.min(depositCredit, total);
  const amountDue = Math.max(0, total - appliedDeposit);
  const receivedNow =
    amountReceived === ""
      ? amountDue
      : Math.max(0, Number(amountReceived) || 0);
  const remainingDue = Math.max(0, Math.round((amountDue - receivedNow) * 100) / 100);
  const tendered =
    tenderedAmount === ""
      ? receivedNow
      : Math.max(0, Number(tenderedAmount) || 0);
  const changeGiven = Math.max(0, Math.round((tendered - receivedNow) * 100) / 100);
  const isWalkIn = !customerId;
  const isPartial = remainingDue > 0.009;
  const isUnpaid = receivedNow <= 0 && amountDue > 0;

  function applyAppointment(appt: PosAppointment, loadServices = true) {
    setAppointmentId(appt.id);
    setCustomerId(appt.customerId);
    setDepositCredit(appt.depositBalance);
    if (appt.staffId) setStaffId(appt.staffId);
    if (loadServices && appt.services.length > 0) {
      setCart(
        appt.services.map((s) => ({
          itemType: "SERVICE" as const,
          itemId: s.serviceId,
          name: s.name,
          unitPrice: s.price,
          quantity: 1,
        }))
      );
    }
  }

  function loadAppointment(apptId: string, loadServices = true) {
    if (!apptId) {
      setAppointmentId("");
      setDepositCredit(0);
      return;
    }
    const appt = appointments.find((a) => a.id === apptId);
    if (appt) applyAppointment(appt, loadServices);
  }

  function handleCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);

    if (!nextCustomerId) {
      setAppointmentId("");
      setDepositCredit(0);
      return;
    }

    const customerAppts = appointments.filter((a) => a.customerId === nextCustomerId);
    const withAdvance = customerAppts.filter((a) => a.depositBalance > 0);

    if (withAdvance.length === 1) {
      applyAppointment(withAdvance[0], false);
      return;
    }

    if (withAdvance.length > 1) {
      const alreadyLinked = withAdvance.find((a) => a.id === appointmentId);
      if (alreadyLinked) {
        setDepositCredit(alreadyLinked.depositBalance);
        return;
      }
      setAppointmentId("");
      setDepositCredit(0);
      return;
    }

    const todayAppt = customerAppts[0];
    if (todayAppt && customerAppts.length === 1) {
      setAppointmentId(todayAppt.id);
      setDepositCredit(todayAppt.depositBalance);
      return;
    }

  if (appointmentId) {
      const linked = appointments.find((a) => a.id === appointmentId);
      if (!linked || linked.customerId !== nextCustomerId) {
        setAppointmentId("");
        setDepositCredit(0);
      }
    }

    startCustomerLookup(async () => {
      const remote = await getCustomerAdvanceAppointments(nextCustomerId);
      if (remote.length === 1) {
        applyAppointment(remote[0], false);
      } else if (remote.length > 1 && !appointmentId) {
        setDepositCredit(0);
      }
    });
  }

  function addItem(item: CartItem) {
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.itemId === item.itemId && c.itemType === item.itemType
      );
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.itemId && c.itemType === item.itemType
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, item];
    });
  }

  function updateQty(itemType: string, itemId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => !(c.itemType === itemType && c.itemId === itemId)));
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.itemType === itemType && c.itemId === itemId ? { ...c, quantity: qty } : c
      )
    );
  }

  async function runCheckout() {
    setError(null);
    if (depositCredit > 0 && !appointmentId) {
      setError("Select the appointment linked to this advance before completing sale.");
      return;
    }
    if (isWalkIn && isPartial) {
      setError("Walk-in customers must pay the full amount.");
      return;
    }
    if (isPartial && !confirmPartial) {
      setError("Confirm that the remaining balance will be customer due.");
      return;
    }
    if (isUnpaid && (!allowUnpaid || !canManage)) {
      setError("Creating an unpaid invoice requires a manager.");
      return;
    }
    const result = await completeCheckout({
      items: cart,
      customerId: customerId || null,
      appointmentId: appointmentId || null,
      staffId: staffId || null,
      discount: discountAmount,
      tax: taxAmount > 0 ? taxAmount : undefined,
      paymentMethod,
      amountReceived: receivedNow,
      tenderedAmount: tendered,
      allowUnpaid: allowUnpaid && canManage,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.saleId) {
      await printSaleReceipt(result.saleId);
      router.push(`/sales/${result.saleId}`);
      router.refresh();
    }
  }

  const checkoutLabel =
    appliedDeposit > 0
      ? `Complete sale · collect ${formatCurrency(receivedNow)}`
      : isPartial
        ? `Complete · due ${formatCurrency(remainingDue)}`
        : "Complete sale";

  const checkoutDescription = isPartial
    ? `Invoice ${formatCurrency(total)}. Collecting ${formatCurrency(receivedNow)} now. Customer will have ${formatCurrency(remainingDue)} outstanding.`
    : amountDue > 0
      ? `Confirm this sale for ${formatCurrency(amountDue)} via ${paymentMethod}? A receipt will print after completion.`
      : `Confirm this sale? Advance covers the full amount. A receipt will print after completion.`;

  const q = search.toLowerCase();
  const filteredServices = services.filter((s) => s.name.toLowerCase().includes(q));
  const filteredProducts = products.filter((s) => s.name.toLowerCase().includes(q));
  const filteredPackages = packages.filter((s) => s.name.toLowerCase().includes(q));

  const customerAppointments = customerId
    ? appointments.filter((a) => a.customerId === customerId)
    : appointments;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <Input
          placeholder="Search services, products, packages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filteredServices.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Services</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    addItem({
                      itemType: "SERVICE",
                      itemId: s.id,
                      name: s.name,
                      unitPrice: Number(s.price),
                      quantity: 1,
                    })
                  }
                  className="rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(s.price)}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {filteredProducts.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Products</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={p.stock_quantity <= 0}
                  onClick={() =>
                    addItem({
                      itemType: "PRODUCT",
                      itemId: p.id,
                      name: p.name,
                      unitPrice: Number(p.retail_price),
                      quantity: 1,
                    })
                  }
                  className="rounded-lg border p-3 text-left hover:bg-muted/50 disabled:opacity-50"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(p.retail_price)} · Stock: {p.stock_quantity}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {filteredPackages.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Packages</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredPackages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    addItem({
                      itemType: "PACKAGE",
                      itemId: p.id,
                      name: p.name,
                      unitPrice: Number(p.price),
                      quantity: 1,
                    })
                  }
                  className="rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(p.price)}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="lg:col-span-2 rounded-lg border p-4 space-y-4 h-fit sticky top-4">
        <h2 className="font-semibold">Cart</h2>

        <div
          className={cn(
            "space-y-3 rounded-lg border p-3",
            depositCredit > 0 ? "border-primary/40 bg-primary/5" : "border-dashed bg-muted/20"
          )}
        >
          <div>
            <p className="text-sm font-medium">Appointment &amp; advance</p>
            <p className="text-xs text-muted-foreground">
              Link an appointment to load services and apply any advance paid at booking.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment">Select appointment</Label>
            <select
              id="appointment"
              value={appointmentId}
              onChange={(e) => loadAppointment(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">None — walk-in sale</option>
              {(customerId ? customerAppointments : appointments).map((a) => (
                <option key={a.id} value={a.id}>
                  {formatApptLabel(a)}
                </option>
              ))}
            </select>
          </div>

          {appointmentsWithAdvance.length > 0 && !appointmentId && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Quick pick — has advance</p>
              {appointmentsWithAdvance.slice(0, 4).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => applyAppointment(a)}
                  className="flex w-full items-center justify-between rounded-md border border-primary/20 bg-background px-2.5 py-2 text-left text-xs hover:bg-primary/10"
                >
                  <span className="truncate pr-2">{a.customerName}</span>
                  <Badge variant="secondary" className="shrink-0 text-primary">
                    {formatCurrency(a.depositBalance)}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {depositCredit > 0 && (
            <div className="rounded-md bg-primary/10 px-3 py-2 text-sm">
              <span className="font-semibold text-primary">{formatCurrency(depositCredit)}</span>
              <span className="text-primary/80"> advance will be deducted at checkout</span>
            </div>
          )}

          {customerLookupPending && (
            <p className="text-xs text-muted-foreground">Checking customer advances…</p>
          )}

          {appointments.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No open appointments. Book one with an advance on the Appointments page first.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="served-by">Served by</Label>
          <select
            id="served-by"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Counts toward staff performance. Auto-fills from the linked appointment.
          </p>
        </div>

        {cart.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add items to begin checkout.</p>
        ) : (
          <ul className="space-y-2">
            {cart.map((item) => (
              <li key={`${item.itemType}-${item.itemId}`} className="flex items-center gap-2 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <Badge variant="secondary" className="text-xs">{item.itemType}</Badge>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQty(item.itemType, item.itemId, Number(e.target.value))}
                  className="w-16"
                />
                <span className="w-20 text-right">{formatCurrency(item.unitPrice * item.quantity)}</span>
                <ConfirmAction
                  title="Remove item?"
                  description={`Remove “${item.name}” from this sale?`}
                  confirmLabel="Remove"
                  pendingLabel="Removing…"
                  variant="ghost"
                  size="icon-sm"
                  onConfirm={async () => {
                    setCart((prev) =>
                      prev.filter(
                        (c) => !(c.itemType === item.itemType && c.itemId === item.itemId)
                      )
                    );
                  }}
                >
                  <X className="size-3.5" />
                </ConfirmAction>
              </li>
            ))}
          </ul>
        )}

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="customer">Customer</Label>
          <select
            id="customer"
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Walk-in</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {formatCustomerName(c.first_name, c.last_name)}
                {c.phone ? ` (${c.phone})` : ""}
              </option>
            ))}
          </select>
          {selectedAppointment && (
            <p className="text-xs text-muted-foreground">
              Linked: {selectedAppointment.customerName} · {selectedAppointment.status}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="discount">Discount (Rs)</Label>
            <Input
              id="discount"
              type="number"
              min={0}
              step={1}
              value={discount || ""}
              placeholder="0"
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment">Payment</Label>
            <select
              id="payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyTax}
              onChange={(e) => {
                setApplyTax(e.target.checked);
                if (!e.target.checked) setTax("");
              }}
              className="size-4 rounded border-input accent-primary"
            />
            <span className="font-medium">Add tax</span>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          {applyTax && (
            <div className="space-y-1.5">
              <Label htmlFor="tax" className="text-xs text-muted-foreground">
                Tax amount (Rs)
              </Label>
              <Input
                id="tax"
                type="number"
                min={0}
                step={1}
                value={tax}
                placeholder="e.g. 150"
                onChange={(e) => setTax(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>+{formatCurrency(taxAmount)}</span>
            </div>
          )}
          {total > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sale total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          )}
          {appliedDeposit > 0 && (
            <div className="flex justify-between font-medium text-primary">
              <span>Advance paid</span>
              <span>-{formatCurrency(appliedDeposit)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-base">
            <span>{appliedDeposit > 0 ? "Collect now" : "Total"}</span>
            <span>{formatCurrency(amountDue)}</span>
          </div>
          {appliedDeposit > 0 && amountDue === 0 && (
            <p className="text-xs text-green-600">Fully covered by advance — no payment needed today.</p>
          )}
        </div>

        {amountDue > 0 ? (
          <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold">Payment now</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={!isPartial ? "default" : "outline"}
                onClick={() => {
                  setAmountReceived(String(amountDue));
                  setTenderedAmount(String(amountDue));
                  setConfirmPartial(false);
                  setAllowUnpaid(false);
                }}
              >
                Pay full ({formatCurrency(amountDue)})
              </Button>
              {!isWalkIn ? (
                <Button
                  type="button"
                  size="sm"
                  variant={isPartial ? "default" : "outline"}
                  onClick={() => {
                    const half = Math.round((amountDue / 2) * 100) / 100;
                    setAmountReceived(String(half));
                    setTenderedAmount(String(half));
                  }}
                >
                  Partial payment
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground self-center">
                  Walk-in must pay full amount
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount-received">Amount customer is paying now (Rs)</Label>
              <Input
                id="amount-received"
                type="number"
                min={0}
                step={1}
                value={amountReceived === "" ? amountDue : amountReceived}
                onChange={(e) => {
                  setAmountReceived(e.target.value);
                  setTenderedAmount(e.target.value);
                }}
              />
            </div>
            {paymentMethod === "CASH" ? (
              <div className="space-y-1">
                <Label htmlFor="tendered">Cash tendered (optional)</Label>
                <Input
                  id="tendered"
                  type="number"
                  min={0}
                  step={1}
                  value={tenderedAmount === "" ? receivedNow : tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                />
                {changeGiven > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Change to return: {formatCurrency(changeGiven)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-between rounded-md bg-background px-2 py-1.5 text-sm">
              <span className="text-muted-foreground">Remaining due (customer owes)</span>
              <span className={remainingDue > 0 ? "font-semibold text-amber-700 dark:text-amber-400" : "font-semibold"}>
                {formatCurrency(remainingDue)}
              </span>
            </div>
            {isPartial && !isWalkIn ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmPartial}
                  onChange={(e) => setConfirmPartial(e.target.checked)}
                />
                <span>
                  I confirm {formatCurrency(remainingDue)} will stay as customer due for{" "}
                  {customers.find((c) => c.id === customerId)
                    ? formatCustomerName(
                        customers.find((c) => c.id === customerId)!.first_name,
                        customers.find((c) => c.id === customerId)!.last_name
                      )
                    : "this customer"}
                  .
                </span>
              </label>
            ) : null}
            {isUnpaid && canManage && !isWalkIn ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={allowUnpaid}
                  onChange={(e) => setAllowUnpaid(e.target.checked)}
                />
                <span>Create as unpaid invoice (manager approval)</span>
              </label>
            ) : null}
            {isWalkIn && isPartial ? (
              <p className="text-xs text-destructive">
                Walk-in must pay in full. Keep Majid Ali (or another customer) selected to leave a due.
              </p>
            ) : null}
          </div>
        ) : null}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <ConfirmAction
          title="Complete this sale?"
          description={checkoutDescription}
          confirmLabel={checkoutLabel}
          pendingLabel="Processing…"
          variant="default"
          size="default"
          className="w-full"
          disabled={cart.length === 0 || (isPartial && !isWalkIn && !confirmPartial)}
          onConfirm={runCheckout}
        >
          {checkoutLabel}
        </ConfirmAction>
      </div>
    </div>
  );
}
