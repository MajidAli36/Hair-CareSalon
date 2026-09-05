"use client";

import { useActionState, useCallback, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  createExpense,
  deleteExpense,
  type ExpenseRow,
  type FinancialSummary,
} from "@/lib/actions/finances";
import type { StaffPaymentRow } from "@/lib/actions/payroll";
import { StaffPaymentForm, StaffPaymentsLog } from "@/components/features/finances/staff-payment-form";
import { SalonMoneyFlowGuide } from "@/components/features/finances/money-flow-guide";
import { InventoryFinancesPanel } from "@/components/features/finances/inventory-finances-panel";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/finances/categories";
import { getPeriodRange } from "@/lib/finances/periods";
import type { ActionResult } from "@/types/commerce";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginatedList } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";

type FinancesDashboardProps = {
  summary: FinancialSummary;
  expenses: ExpenseRow[];
  staffPayments: StaffPaymentRow[];
  staffList: { id: string; full_name: string }[];
  from: string;
  to: string;
};

export function FinancesDashboard({
  summary,
  expenses,
  staffPayments,
  staffList,
  from,
  to,
}: FinancesDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [expenseState, expenseAction, expensePending] = useActionState(
    createExpense,
    {} as ActionResult
  );

  const applyRange = useCallback(
    (newFrom: string, newTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", newFrom);
      params.set("to", newTo);
      startTransition(() => router.push(`/finances?${params.toString()}`));
    },
    [router, searchParams]
  );

  const syncAfterRecord = useCallback(
    (recordDate?: string) => {
      if (!recordDate) {
        router.refresh();
        return;
      }
      let newFrom = from;
      let newTo = to;
      if (recordDate < from) newFrom = recordDate;
      if (recordDate > to) newTo = recordDate;
      if (newFrom !== from || newTo !== to) {
        applyRange(newFrom, newTo);
      } else {
        router.refresh();
      }
    },
    [from, to, router, applyRange]
  );

  useEffect(() => {
    if (expenseState.success) {
      syncAfterRecord(expenseState.recordDate);
    }
  }, [expenseState.success, expenseState.recordDate, syncAfterRecord]);

  function setPreset(preset: "today" | "week" | "month") {
    const { from: fromStr, to: toStr } = getPeriodRange(preset);
    applyRange(fromStr, toStr);
  }

  return (
    <div className="space-y-6">
      <SalonMoneyFlowGuide />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setPreset("today")}>
            Today
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setPreset("week")}>
            This week
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setPreset("month")}>
            This month
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="fin-from" className="text-xs">From</Label>
            <Input
              id="fin-from"
              type="date"
              value={from}
              className="h-8 w-36"
              onChange={(e) => applyRange(e.target.value, to)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-to" className="text-xs">To</Label>
            <Input
              id="fin-to"
              type="date"
              value={to}
              className="h-8 w-36"
              onChange={(e) => applyRange(from, e.target.value)}
            />
          </div>
        </div>
      </div>

      <p className="text-sm font-medium text-foreground">{summary.periodLabel}</p>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Money flow summary</CardTitle>
          <CardDescription>All income and outflows for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FlowItem
              label="Money in"
              value={summary.totalInflow}
              variant="in"
              detail="Cash/card sales + advances"
            />
            <FlowItem label="Money out" value={summary.totalOutflow} variant="out" detail="Expenses + staff + product COGS" />
            <FlowItem label="Net cash flow" value={summary.netCashFlow} variant={summary.netCashFlow >= 0 ? "profit" : "loss"} />
            <FlowItem label="Net profit" value={summary.netProfit} variant={summary.netProfit >= 0 ? "profit" : "loss"} detail="Sales − all costs − COGS" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Sales revenue"
          value={formatCurrency(summary.salesRevenue)}
          subtitle={`${summary.saleCount} POS sales`}
        />
        <SummaryCard
          title="Advances in"
          value={formatCurrency(summary.advancesCollected)}
          subtitle="Customer deposits"
        />
        <SummaryCard
          title="Expenses"
          value={formatCurrency(summary.totalExpenses)}
          subtitle={`${summary.expenseCount} entries`}
          variant="expense"
        />
        <SummaryCard
          title="Staff paid"
          value={formatCurrency(summary.staffPayments)}
          subtitle={`${summary.staffPaymentCount} payments`}
          variant="expense"
        />
        <SummaryCard
          title="Net profit"
          value={formatCurrency(summary.netProfit)}
          subtitle="Sales − expenses − staff − COGS"
          variant={summary.netProfit >= 0 ? "profit" : "loss"}
        />
        <SummaryCard
          title="Net cash flow"
          value={formatCurrency(summary.netCashFlow)}
          subtitle="Money in − money out"
          variant={summary.netCashFlow >= 0 ? "profit" : "loss"}
        />
        <SummaryCard
          title="Unapplied advances"
          value={formatCurrency(summary.unappliedDeposits)}
          subtitle="Held for future checkout"
        />
      </div>

      <InventoryFinancesPanel summary={summary} />

      {summary.unappliedDeposits > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm">
              <span className="font-medium">Unapplied advances on hand:</span>{" "}
              {formatCurrency(summary.unappliedDeposits)} — collected from customers, not yet used at POS.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <StaffPaymentForm staff={staffList} defaultDate={to} onRecorded={syncAfterRecord} />

        <Card>
          <CardHeader>
            <CardTitle>Staff payments log</CardTitle>
            <CardDescription>Salaries, partial payments, advances, and bonuses</CardDescription>
          </CardHeader>
          <CardContent>
            <StaffPaymentsLog payments={staffPayments} from={from} to={to} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add expense</CardTitle>
            <CardDescription>
              Rent, utilities, marketing, etc. For product restocking use Products → Inventory →
              Stock In (avoid double-counting as Supplies).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={expenseAction} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    required
                    className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                    defaultValue="OTHER"
                  >
                    {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (Rs)</Label>
                  <Input id="amount" name="amount" type="number" min={1} step={1} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense_date">Date</Label>
                  <Input
                    id="expense_date"
                    name="expense_date"
                    type="date"
                    required
                    key={to}
                    defaultValue={to}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Paid via</Label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                    defaultValue="CASH"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="e.g. Monthly rent" />
              </div>
              {expenseState.error && <p className="text-sm text-destructive">{expenseState.error}</p>}
              {expenseState.success && <p className="text-sm text-green-600">Expense recorded.</p>}
              <Button type="submit" disabled={expensePending}>
                {expensePending ? "Saving…" : "Add expense"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses in this period.</p>
            ) : (
              <ul className="space-y-2">
                {summary.expensesByCategory.map((row) => (
                  <li key={row.category} className="flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium">{formatCurrency(row.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense log</CardTitle>
        </CardHeader>
        <CardContent>
          <PaginatedList
            items={expenses}
            empty={
              <p className="text-sm text-muted-foreground">
                No expenses for {from === to ? from : `${from} → ${to}`}. Try &quot;This week&quot;
                or widen the date range above.
              </p>
            }
          >
            {(slice) => (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((expense) => (
                      <ExpenseRowItem key={expense.id} expense={expense} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </PaginatedList>
        </CardContent>
      </Card>
    </div>
  );
}

function FlowItem({
  label,
  value,
  detail,
  variant,
}: {
  label: string;
  value: number;
  detail?: string;
  variant?: "in" | "out" | "profit" | "loss";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        variant === "in" && "border-green-200 bg-green-50/50",
        variant === "out" && "border-orange-200 bg-orange-50/30",
        variant === "profit" && "border-green-200 bg-green-50/50",
        variant === "loss" && "border-red-200 bg-red-50/50"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{formatCurrency(value)}</p>
      {detail && <p className="text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  variant,
}: {
  title: string;
  value: string;
  subtitle: string;
  variant?: "profit" | "loss" | "expense";
}) {
  return (
    <Card
      className={cn(
        variant === "profit" && "border-green-200 bg-green-50/50",
        variant === "loss" && "border-red-200 bg-red-50/50",
        variant === "expense" && "border-orange-200/60"
      )}
    >
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ExpenseRowItem({ expense }: { expense: ExpenseRow }) {
  return (
    <TableRow>
      <TableCell>{expense.expense_date}</TableCell>
      <TableCell>{EXPENSE_CATEGORY_LABELS[expense.category]}</TableCell>
      <TableCell className="text-muted-foreground">{expense.description ?? "—"}</TableCell>
      <TableCell>{expense.payment_method}</TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
      <TableCell>
        <ConfirmAction
          title="Delete expense?"
          description={`Delete this ${EXPENSE_CATEGORY_LABELS[expense.category]} expense of ${formatCurrency(expense.amount)}? This affects finances totals.`}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          onConfirm={async () => {
            await deleteExpense(expense.id);
          }}
        >
          <Trash2 className="size-3.5" />
        </ConfirmAction>
      </TableCell>
    </TableRow>
  );
}
