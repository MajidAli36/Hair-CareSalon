"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { CustomersReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportDonutChart,
  ReportLineChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CustomersTab({ data }: { data: CustomersReport }) {
  const [q, setQ] = useState("");
  const k = data.kpis;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data.ledger;
    return data.ledger.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.phone ?? "").includes(term) ||
        r.segment.toLowerCase().includes(term)
    );
  }, [data.ledger, q]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total customers" value={String(k.totalCustomers.current)} compare={k.totalCustomers} />
        <KpiCard label="New (period)" value={String(k.newCustomers.current)} compare={k.newCustomers} />
        <KpiCard label="Returning (period)" value={String(k.returningCustomers.current)} compare={k.returningCustomers} />
        <KpiCard label="Active" value={String(k.activeCustomers.current)} />
        <KpiCard label="Inactive" value={String(k.inactiveCustomers.current)} invertTrend />
        <KpiCard label="Avg spend / visit" value={formatCurrency(k.avgSpend.current)} hint="Total spend ÷ visits" />
        <KpiCard label="Avg visits" value={k.avgVisits.current.toFixed(1)} />
        <KpiCard label="Avg lifetime value" value={formatCurrency(k.clv.current)} hint="Mean historical spend" />
        <KpiCard label="Retention rate" value={`${k.retentionRate.current.toFixed(1)}%`} hint="Bought again vs prior period buyers" />
        <KpiCard label="At risk" value={String(k.atRisk.current)} invertTrend hint="60–90 days quiet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="New customers by day" defaultOpen>
          <ReportLineChart data={data.growthByDay} emptyMessage="No new customers in this period." valueLabel="New" />
        </ReportSection>
        <ReportSection title="New vs returning" defaultOpen>
          <ReportDonutChart data={data.newVsReturning} emptyMessage="No customer activity in this period." />
        </ReportSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Top by revenue" defaultOpen>
          <CustomerMini rows={data.topByRevenue} />
        </ReportSection>
        <ReportSection title="Top by visits" defaultOpen>
          <CustomerMini rows={data.topByVisits} visits />
        </ReportSection>
      </div>

      <ReportSection
        title="Customer ledger"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `customers-${data.from}-${data.to}.csv`,
                ["Name", "Phone", "Visits", "Total spend", "Avg spend", "Segment", "Last visit"],
                filtered.map((r) => [
                  r.name,
                  r.phone ?? "",
                  r.visits,
                  r.totalSpend,
                  r.avgSpend,
                  r.segment,
                  r.lastVisit ?? "",
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        <Input
          placeholder="Search name, phone, segment…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3 max-w-sm print:hidden"
        />
        {!filtered.length ? (
          <ReportEmpty message="No customers found." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 250).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.phone ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.visits}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.totalSpend)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.segment}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.lastVisit ? formatDate(r.lastVisit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSection>
    </div>
  );
}

function CustomerMini({
  rows,
  visits,
}: {
  rows: CustomersReport["topByRevenue"];
  visits?: boolean;
}) {
  if (!rows.length) return <ReportEmpty message="No customer sales yet." />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">{visits ? "Visits" : "Spend"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">
                {visits ? r.visits : formatCurrency(r.totalSpend)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
