"use client";

import { formatDateTime } from "@/lib/format";
import { downloadCsv } from "@/lib/reports/export-csv";
import type { AppointmentsReport } from "@/lib/actions/reports";
import { KpiCard } from "@/components/features/reports/ui/kpi-card";
import { ReportSection } from "@/components/features/reports/ui/report-section";
import {
  ReportBarChart,
  ReportDonutChart,
  ReportLineChart,
} from "@/components/features/reports/ui/report-charts";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AppointmentsTab({ data }: { data: AppointmentsReport }) {
  const k = data.kpis;
  const maxHeat = Math.max(1, ...data.heatmap.map((h) => h.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total" value={String(k.total.current)} compare={k.total} />
        <KpiCard label="Completed" value={String(k.completed.current)} compare={k.completed} />
        <KpiCard label="Pending" value={String(k.pending.current)} compare={k.pending} />
        <KpiCard label="Confirmed" value={String(k.confirmed.current)} compare={k.confirmed} />
        <KpiCard label="Cancelled" value={String(k.cancelled.current)} compare={k.cancelled} invertTrend />
        <KpiCard label="No-shows" value={String(k.noShow.current)} compare={k.noShow} invertTrend />
        <KpiCard label="Completion rate" value={`${k.completionRate.current.toFixed(1)}%`} compare={k.completionRate} />
        <KpiCard label="Cancel rate" value={`${k.cancellationRate.current.toFixed(1)}%`} compare={k.cancellationRate} invertTrend />
        <KpiCard label="No-show rate" value={`${k.noShowRate.current.toFixed(1)}%`} compare={k.noShowRate} invertTrend />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="Appointment trend" defaultOpen>
          <ReportLineChart data={data.byDay} emptyMessage="No appointments in this period." valueLabel="Appts" />
        </ReportSection>
        <ReportSection title="By status" defaultOpen>
          <ReportDonutChart data={data.byStatus} emptyMessage="No appointments in this period." />
        </ReportSection>
      </div>

      <ReportSection title="Peak booking heatmap" description="Day × hour density" defaultOpen>
        {!data.heatmap.some((h) => h.count > 0) ? (
          <ReportEmpty message="No appointments to build a heatmap." />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="inline-grid min-w-full gap-0.5"
              style={{ gridTemplateColumns: "56px repeat(14, minmax(28px, 1fr))" }}
            >
              <div />
              {Array.from({ length: 14 }, (_, i) => i + 8).map((hour) => (
                <div key={hour} className="text-center text-[10px] text-muted-foreground">
                  {hour}
                </div>
              ))}
              {DAY_LABELS.map((label, day) => (
                <div key={label} className="contents">
                  <div className="flex items-center text-xs font-medium text-muted-foreground">{label}</div>
                  {Array.from({ length: 14 }, (_, i) => i + 8).map((hour) => {
                    const cell = data.heatmap.find((h) => h.day === day && h.hour === hour);
                    const count = cell?.count ?? 0;
                    const intensity = count / maxHeat;
                    return (
                      <div
                        key={`${day}-${hour}`}
                        title={`${label} ${hour}:00 — ${count}`}
                        className={cn(
                          "flex h-7 items-center justify-center rounded-sm text-[10px] font-medium",
                          count === 0 ? "bg-muted/40 text-transparent" : "text-white"
                        )}
                        style={
                          count === 0
                            ? undefined
                            : { backgroundColor: `rgba(15, 118, 110, ${0.25 + intensity * 0.75})` }
                        }
                      >
                        {count || ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </ReportSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection title="By staff" defaultOpen>
          <ReportBarChart
            data={data.byStaff.slice(0, 12).map((r) => ({ label: r.name, value: r.value }))}
            horizontal
            emptyMessage="No staff appointments."
            valueLabel="Appts"
          />
        </ReportSection>
        <ReportSection title="By service" defaultOpen>
          <ReportBarChart
            data={data.byService.slice(0, 12).map((r) => ({ label: r.name, value: r.value }))}
            horizontal
            emptyMessage="No booked services."
            valueLabel="Bookings"
          />
        </ReportSection>
      </div>

      <ReportSection
        title="Appointment ledger"
        defaultOpen
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `appointments-${data.from}-${data.to}.csv`,
                ["When", "Customer", "Staff", "Status", "Services", "Source"],
                data.ledger.map((r) => [
                  r.scheduledAt,
                  r.customerName,
                  r.staffName ?? "",
                  r.status,
                  r.services,
                  r.source,
                ])
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        {!data.ledger.length ? (
          <ReportEmpty message="No appointments found for the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Services</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ledger.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(r.scheduledAt)}
                    </TableCell>
                    <TableCell className="font-medium">{r.customerName}</TableCell>
                    <TableCell>{r.staffName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{r.services || "—"}</TableCell>
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
