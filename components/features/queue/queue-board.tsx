"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { issueWalkInToken, updateTokenStatus, openDrawer } from "@/lib/actions/queue";
import { getTokenReceiptHtml } from "@/lib/actions/print";
import { printThermalHtml } from "@/lib/print/browser";
import { getLocalDateString } from "@/lib/dates/local";
import { CustomerPicker } from "@/components/features/queue/customer-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ActionResult } from "@/types/commerce";
import { formatDate, formatTime } from "@/lib/format";
import { PaginatedList } from "@/components/ui/table-pagination";
import Link from "next/link";

type Token = {
  id: string;
  token_number: number;
  customer_name: string;
  customer_id: string | null;
  staff_id: string | null;
  chair_id: string | null;
  chair: string | null;
  issued_at: string;
  status: string;
  created_at: string;
  customer?: { phone: string | null; email: string | null } | null;
  staff?: { id: string; full_name: string } | null;
};

type Customer = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
};

type StaffMember = {
  id: string;
  full_name: string;
};

type ChairOption = {
  id: string;
  name: string;
};

type Props = {
  tokens: Token[];
  customers: Customer[];
  staff: StaffMember[];
  chairs: ChairOption[];
  date: string;
  tokenCount: number;
  canManageChairs: boolean;
};

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function QueueBoard({
  tokens,
  customers,
  staff,
  chairs,
  date,
  tokenCount,
  canManageChairs,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(
    issueWalkInToken,
    {} as ActionResult & {
      tokenNumber?: number;
      customerName?: string;
      customerPhone?: string | null;
      staffName?: string | null;
      chair?: string | null;
      issuedAt?: string;
      queueDate?: string;
    }
  );
  const [drawerPending, startDrawer] = useTransition();
  const lastPrintedToken = useRef<number | null>(null);
  const [tokenTime, setTokenTime] = useState(currentTimeValue);

  const filterStaff = searchParams.get("staff") ?? "";
  const filterChair = searchParams.get("chair") ?? "";

  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      if (filterStaff && t.staff_id !== filterStaff) return false;
      if (filterChair && t.chair_id !== filterChair) return false;
      return true;
    });
  }, [tokens, filterStaff, filterChair]);

  useEffect(() => {
    if (!state.success || !state.tokenNumber) return;
    if (lastPrintedToken.current === state.tokenNumber) return;
    lastPrintedToken.current = state.tokenNumber;

    void getTokenReceiptHtml({
      tokenNumber: state.tokenNumber,
      customerName: state.customerName || "Walk-in",
      customerPhone: state.customerPhone,
      staffName: state.staffName,
      chair: state.chair,
      queueDate: state.queueDate ?? date,
      issuedAt: state.issuedAt,
    }).then((html) => printThermalHtml(html));

    setTokenTime(currentTimeValue());
  }, [state, date]);

  function changeParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/queue?${params.toString()}`);
  }

  const isToday = date === getLocalDateString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="queue-date">Queue date</Label>
          <Input
            id="queue-date"
            type="date"
            value={date}
            className="w-40"
            onChange={(e) => changeParams({ date: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="filter-staff" className="text-xs">
              Filter staff
            </Label>
            <select
              id="filter-staff"
              className="flex h-8 rounded-lg border border-input bg-background px-2 text-sm"
              value={filterStaff}
              onChange={(e) => changeParams({ staff: e.target.value })}
            >
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-chair" className="text-xs">
              Filter chair
            </Label>
            <select
              id="filter-chair"
              className="flex h-8 rounded-lg border border-input bg-background px-2 text-sm"
              value={filterChair}
              onChange={(e) => changeParams({ chair: e.target.value })}
            >
              <option value="">All chairs</option>
              {chairs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredTokens.length}</span>
          {filteredTokens.length !== tokenCount ? ` of ${tokenCount}` : ""} token
          {tokenCount === 1 ? "" : "s"} on {date}
        </div>
        <Button
          variant="outline"
          disabled={drawerPending}
          onClick={() =>
            startDrawer(async () => {
              await openDrawer("queue");
            })
          }
        >
          Open cash drawer
        </Button>
      </div>

      {isToday ? (
        <form action={formAction} className="space-y-4 rounded-lg border p-4">
          <input type="hidden" name="token_date" value={date} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <CustomerPicker
                id="customer_id"
                name="customer_id"
                customers={customers}
                required
                placeholder="Type to search name or phone…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff_id">Staff (optional)</Label>
              <select
                id="staff_id"
                name="staff_id"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                defaultValue=""
              >
                <option value="">Any / unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chair_id">Chair (optional)</Label>
              <select
                id="chair_id"
                name="chair_id"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                defaultValue=""
                disabled={chairs.length === 0}
              >
                <option value="">No chair</option>
                {chairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {chairs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {canManageChairs ? (
                    <>
                      No chairs yet.{" "}
                      <Link href="/chairs" className="underline underline-offset-2">
                        Add chairs
                      </Link>
                    </>
                  ) : (
                    "Ask a manager to add chairs."
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="token_time">Token time *</Label>
              <Input
                id="token_time"
                name="token_time"
                type="time"
                required
                value={tokenTime}
                onChange={(e) => setTokenTime(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Issuing…" : "Issue token"}
            </Button>
            {(state.tokenNumber || state.success) && (
              <p className="text-lg font-bold text-primary">Token #{state.tokenNumber}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Customer, token time, and optional staff/chair are saved with each token. Receipt
              prints automatically.
            </p>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Viewing past/future queue. Switch to today&apos;s date to issue a new token.
        </p>
      )}

      {filteredTokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tokens.length === 0
            ? "No tokens for this date."
            : "No tokens match the staff/chair filters."}
        </p>
      ) : (
        <PaginatedList items={filteredTokens}>
          {(slice) => (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slice.map((t) => (
                <TokenCard key={t.id} token={t} queueDate={date} />
              ))}
            </div>
          )}
        </PaginatedList>
      )}
    </div>
  );
}

function TokenCard({ token, queueDate }: { token: Token; queueDate: string }) {
  const [pending, startTransition] = useTransition();
  const customer = token.customer as { phone: string | null; email: string | null } | null;
  const issuedAt = token.issued_at || token.created_at;

  function reprint() {
    startTransition(async () => {
      const html = await getTokenReceiptHtml({
        tokenNumber: token.token_number,
        customerName: token.customer_name,
        customerPhone: customer?.phone,
        staffName: token.staff?.full_name,
        chair: token.chair,
        queueDate,
        issuedAt,
      });
      printThermalHtml(html);
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-3xl font-bold">#{token.token_number}</span>
        <Badge>{token.status}</Badge>
      </div>
      <p className="font-medium">{token.customer_name}</p>
      {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {token.staff?.full_name && (
          <Badge variant="outline">Staff: {token.staff.full_name}</Badge>
        )}
        {token.chair && <Badge variant="outline">{token.chair}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        Token time:{" "}
        <span className="font-medium text-foreground">{formatTime(issuedAt)}</span>
        <span className="text-muted-foreground"> · {formatDate(issuedAt)}</span>
      </p>
      <div className="flex flex-wrap gap-1 pt-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={reprint}>
          {pending ? "…" : "Reprint"}
        </Button>
        {token.status === "WAITING" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateTokenStatus(token.id, "CALLED");
              })
            }
          >
            Call
          </Button>
        )}
        {token.status === "CALLED" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateTokenStatus(token.id, "SERVING");
              })
            }
          >
            Serve
          </Button>
        )}
        {["CALLED", "SERVING"].includes(token.status) && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateTokenStatus(token.id, "COMPLETED");
              })
            }
          >
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
