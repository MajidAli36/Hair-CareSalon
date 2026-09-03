"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type RevenueChartProps = {
  revenueByDay: { date: string; revenue: number }[];
  appointmentsByDay: { date: string; count: number }[];
};

type Range = 7 | 30 | 90;

export function RevenueChart({ revenueByDay, appointmentsByDay }: RevenueChartProps) {
  const [range, setRange] = useState<Range>(30);

  const chartData = useMemo(() => {
    const slice = revenueByDay.slice(-range);
    const apptMap = new Map(appointmentsByDay.map((a) => [a.date, a.count]));
    return slice.map((d) => ({
      date: d.date.slice(5),
      revenue: d.revenue,
      appointments: apptMap.get(d.date) ?? 0,
    }));
  }, [revenueByDay, appointmentsByDay, range]);

  const hasData = chartData.some((d) => d.revenue > 0 || d.appointments > 0);

  return (
    <div className="dashboard-card p-5">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Revenue Overview</h3>
          <p className="text-xs text-muted-foreground">Revenue and appointment activity</p>
        </div>
        <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150",
                range === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r} Days
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
          <p className="text-sm text-muted-foreground">No revenue data for this period yet.</p>
        </div>
      ) : (
        <div className="h-[240px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
                formatter={(value, name) => [
                  name === "revenue" ? formatCurrency(Number(value)) : value,
                  name === "revenue" ? "Revenue" : "Appointments",
                ]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0f766e"
                strokeWidth={2}
                fill="url(#revenueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
