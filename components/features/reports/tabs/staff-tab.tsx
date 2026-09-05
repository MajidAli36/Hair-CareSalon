"use client";

import { formatCurrency } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { StaffReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import { ReportBarChart } from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

export function StaffTab({ data }: { data: StaffReport }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Staff-linked revenue" value={formatCurrency(k.staffRevenue.current)} compare={k.staffRevenue} />
        <KpiCard label="Appts completed" value={String(k.appointmentsCompleted.current)} compare={k.appointmentsCompleted} />
        <KpiCard label="Avg ticket (linked)" value={formatCurrency(k.avgTicket.current)} compare={k.avgTicket} />
        <KpiCard label="Unassigned sales" value={formatCurrency(k.unassignedRevenue.current)} compare={k.unassignedRevenue} />
      </div>

      <ReportSection title="Staff revenue ranking" defaultOpen>
        <ReportBarChart
          data={data.ranking
            .filter((r) => r.linkedSalesRevenue > 0)
            .slice(0, 12)
            .map((r) => ({ label: r.name, value: r.linkedSalesRevenue }))}
          horizontal
          currency
          emptyMessage="No appointment-linked sales in this period."
        />
      </ReportSection>

      <ReportSection
        title="Staff performance"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `staff-${data.from}-${data.to}.csv`,
                ["Staff", "Appts", "Completed", "Cancelled", "No-show", "Completion %", "Linked revenue", "Customers"],
                data.ranking.map((r) => [
                  r.name,
                  r.appointments,
                  r.completed,
                  r.cancelled,
                  r.noShow,
                  r.completionRate.toFixed(1),
                  r.linkedSalesRevenue,
                  r.customersServed,
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        {!data.ranking.length ? (
          <ReportEmpty message="No active staff found." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Appts</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ranking.map((r) => (
                  <TableRow key={r.staffId ?? r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.appointments}</TableCell>
                    <TableCell className="text-right">{r.completed}</TableCell>
                    <TableCell className="text-right">{r.completionRate.toFixed(0)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.linkedSalesRevenue)}</TableCell>
                    <TableCell className="text-right">{r.customersServed}</TableCell>
                    <TableCell className="text-right">
                      {r.staffId ? (
                        <Button type="button" size="sm" variant="outline" render={<Link href={`/staff/${r.staffId}`} />}>
                          View
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportSection>

      <ReportSection title="Notes">
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </ReportSection>
    </div>
  );
}
