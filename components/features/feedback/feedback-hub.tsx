"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  submitCustomerFeedback,
  type FeedbackDashboard,
} from "@/lib/actions/feedback";
import type { ActionResult } from "@/types/commerce";
import {
  FEEDBACK_DIMENSIONS,
  IMPROVEMENT_THRESHOLD,
  scoreTone,
  type FeedbackDimensionKey,
  type FeedbackRatings,
} from "@/lib/feedback/dimensions";
import { formatCustomerName, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Star } from "lucide-react";

type CustomerOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
};

type StaffOption = { id: string; full_name: string };

const DEFAULT_RATINGS: FeedbackRatings = {
  overall: 8,
  behaviour: 8,
  expertise: 8,
  service: 8,
  cleanliness: 8,
  value: 8,
  wait_time: 8,
};

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const tone = scoreTone(value);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "good" && "bg-emerald-600",
          tone === "ok" && "bg-amber-500",
          tone === "bad" && "bg-destructive"
        )}
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}

function RatingCard({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const tone = scoreTone(value);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription className="mt-1">{hint}</CardDescription>
          </div>
          <Badge
            variant={tone === "bad" ? "destructive" : tone === "ok" ? "outline" : "default"}
            className="tabular-nums"
          >
            {value}/10
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar value={value} />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                value === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CollectFeedbackForm({
  customers,
  staff,
}: {
  customers: CustomerOption[];
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"customer" | "walkin">("customer");
  const [customerId, setCustomerId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [staffId, setStaffId] = useState("");
  const [ratings, setRatings] = useState<FeedbackRatings>({ ...DEFAULT_RATINGS });
  const [comment, setComment] = useState("");
  const [state, action, pending] = useActionState(submitCustomerFeedback, {} as ActionResult);

  useEffect(() => {
    if (state.success) {
      setStep(1);
      setCustomerId("");
      setWalkInName("");
      setStaffId("");
      setRatings({ ...DEFAULT_RATINGS });
      setComment("");
      router.refresh();
    }
  }, [state.success, router]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 40);
    return customers
      .filter((c) => {
        const name = formatCustomerName(c.first_name, c.last_name).toLowerCase();
        return name.includes(q) || (c.phone ?? "").toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const guestLabel =
    mode === "walkin"
      ? walkInName.trim() || "Walk-in"
      : selectedCustomer
        ? formatCustomerName(selectedCustomer.first_name, selectedCustomer.last_name)
        : "";

  function canGoStep2() {
    if (mode === "walkin") return walkInName.trim().length > 0;
    return Boolean(customerId);
  }

  function setRating(key: FeedbackDimensionKey, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                step === n
                  ? "bg-primary text-primary-foreground"
                  : step > n
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {n}
            </span>
            <span className={cn("hidden sm:inline", step === n ? "font-medium" : "text-muted-foreground")}>
              {n === 1 ? "Customer" : n === 2 ? "Ratings" : "Review"}
            </span>
            {n < 3 && <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("customer");
                setWalkInName("");
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                mode === "customer" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              )}
            >
              <p className="font-medium">Registered customer</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Link feedback to an existing profile
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("walkin");
                setCustomerId("");
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                mode === "walkin" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              )}
            >
              <p className="font-medium">Walk-in customer</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No profile — enter a name and rate the visit
              </p>
            </button>
          </div>

          {mode === "customer" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="customer-search">Find customer</Label>
                <Input
                  id="customer-search"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search name or phone…"
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {filteredCustomers.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">No customers found.</p>
                ) : (
                  filteredCustomers.map((c) => {
                    const selected = customerId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm",
                          selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        <span className="font-medium">
                          {formatCustomerName(c.first_name, c.last_name)}
                        </span>
                        <span className={cn("text-xs", selected ? "opacity-80" : "text-muted-foreground")}>
                          {c.phone ?? "—"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="walk-in-name">Walk-in name</Label>
              <Input
                id="walk-in-name"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="e.g. Guest — Ali"
                maxLength={120}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="served-by-feedback">Stylist (optional)</Label>
            <select
              id="served-by-feedback"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">Any / not specified</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button type="button" disabled={!canGoStep2()} onClick={() => setStep(2)}>
              Next: Ratings
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rating for <span className="font-medium text-foreground">{guestLabel}</span> — tap 0–10 on
            each card.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {FEEDBACK_DIMENSIONS.map((dim) => (
              <RatingCard
                key={dim.key}
                label={dim.label}
                hint={dim.hint}
                value={ratings[dim.key]}
                onChange={(v) => setRating(dim.key, v)}
              />
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Next: Review
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="customer_id" value={mode === "customer" ? customerId : ""} />
          <input type="hidden" name="walk_in_name" value={mode === "walkin" ? walkInName : ""} />
          <input type="hidden" name="staff_id" value={staffId} />
          {FEEDBACK_DIMENSIONS.map((dim) => (
            <input
              key={dim.key}
              type="hidden"
              name={`rating_${dim.key === "wait_time" ? "wait_time" : dim.key}`}
              value={ratings[dim.key]}
            />
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review & submit</CardTitle>
              <CardDescription>
                {guestLabel}
                {staffId
                  ? ` · ${staff.find((s) => s.id === staffId)?.full_name ?? "Staff"}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {FEEDBACK_DIMENSIONS.map((dim) => (
                  <div
                    key={dim.key}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{dim.label}</span>
                    <span className="font-semibold tabular-nums">{ratings[dim.key]}/10</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-comment">Comment (optional)</Label>
                <textarea
                  id="feedback-comment"
                  name="comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  placeholder="Anything else the customer said…"
                  className="flex w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Feedback saved.
            </p>
          )}

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save feedback"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function FeedbackDashboardPanel({ data }: { data: FeedbackDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Responses</CardDescription>
            <CardTitle className="text-2xl">{data.totalResponses}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.from === data.to
              ? formatDateTime(`${data.from}T12:00:00+05:00`).split(" · ")[0]
              : `${data.from} – ${data.to}`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Visit average (all areas)</CardDescription>
            <CardTitle className="text-2xl">
              {data.totalResponses ? `${data.overallAverage}/10` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {data.totalResponses > 0 && <ScoreBar value={data.overallAverage} />}
            <p>Overall experience alone: {data.overallExperienceAverage}/10</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Needs improvement</CardDescription>
            <CardTitle className="text-2xl">{data.needsImprovement.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Areas under {IMPROVEMENT_THRESHOLD}/10
          </CardContent>
        </Card>
      </div>

      {data.needsImprovement.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Focus areas
            </CardTitle>
            <CardDescription>
              Lowest-scoring aspects this period — coach the team on these first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.needsImprovement.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="tabular-nums text-amber-700 dark:text-amber-400">
                    {item.average}/10
                  </span>
                </div>
                <ScoreBar value={item.average} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All rating areas</CardTitle>
          <CardDescription>Average by category · 0–10</CardDescription>
        </CardHeader>
        <CardContent>
          {!data.totalResponses ? (
            <p className="text-sm text-muted-foreground">
              No feedback yet this period. Collect ratings from the Collect tab.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.dimensionAverages.map((dim) => (
                <div key={dim.key} className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{dim.label}</p>
                    <div className="flex items-center gap-2">
                      {dim.needsImprovement && (
                        <Badge variant="outline" className="text-amber-700">
                          Improve
                        </Badge>
                      )}
                      <span className="text-sm font-semibold tabular-nums">{dim.average}/10</span>
                    </div>
                  </div>
                  <ScoreBar value={dim.average} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data.lowScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low scores to review</CardTitle>
            <CardDescription>Visits averaging under {IMPROVEMENT_THRESHOLD}/10</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowScores.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.customerName}
                      {row.isWalkIn && (
                        <Badge variant="secondary" className="ml-2">
                          Walk-in
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.staffName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-destructive">
                      {row.averageScore}/10
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.recent.length ? (
            <p className="text-sm text-muted-foreground">No responses yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.customerName}</div>
                      {row.comment && (
                        <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {row.comment}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.staffName ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.overall}/10</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {row.averageScore}/10
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

export function FeedbackHub({
  customers,
  staff,
  dashboard,
}: {
  customers: CustomerOption[];
  staff: StaffOption[];
  dashboard: FeedbackDashboard;
}) {
  return (
    <Tabs defaultValue="collect" className="space-y-4">
      <TabsList>
        <TabsTrigger value="collect">Collect feedback</TabsTrigger>
        <TabsTrigger value="dashboard">Improvement dashboard</TabsTrigger>
      </TabsList>

      <TabsContent value="collect">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-5" />
              New customer feedback
            </CardTitle>
            <CardDescription>
              Choose the customer (or walk-in), then rate staff behaviour, expertise, service, and
              more — each from 0 to 10.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CollectFeedbackForm customers={customers} staff={staff} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="dashboard">
        <FeedbackDashboardPanel data={dashboard} />
      </TabsContent>
    </Tabs>
  );
}
