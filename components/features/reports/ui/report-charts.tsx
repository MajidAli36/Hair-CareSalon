"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { ReportEmpty } from "@/components/features/reports/ui/report-states";

const COLORS = ["#0f766e", "#14b8a6", "#64748b", "#d97706", "#dc2626", "#2563eb", "#7c3aed"];

type Point = { label: string; value: number; secondary?: number };

export function ReportLineChart({
  data,
  emptyMessage = "No data for this period.",
  valueLabel = "Value",
  currency = false,
}: {
  data: Point[];
  emptyMessage?: string;
  valueLabel?: string;
  currency?: boolean;
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <ReportEmpty message={emptyMessage} />;
  }

  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="reportAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => (currency && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
            formatter={(value) => [
              currency ? formatCurrency(Number(value)) : Number(value),
              valueLabel,
            ]}
          />
          <Area type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} fill="url(#reportAreaFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportBarChart({
  data,
  emptyMessage = "No data for this period.",
  valueLabel = "Value",
  currency = false,
  horizontal = false,
}: {
  data: Point[];
  emptyMessage?: string;
  valueLabel?: string;
  currency?: boolean;
  horizontal?: boolean;
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <ReportEmpty message={emptyMessage} />;
  }

  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 4, right: 8, left: horizontal ? 8 : 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={!horizontal} horizontal={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={96}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => (currency && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
            </>
          )}
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
            formatter={(value) => [
              currency ? formatCurrency(Number(value)) : Number(value),
              valueLabel,
            ]}
          />
          <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportDonutChart({
  data,
  emptyMessage = "No data for this period.",
  currency = false,
}: {
  data: { name: string; value: number }[];
  emptyMessage?: string;
  currency?: boolean;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ReportEmpty message={emptyMessage} />;

  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
            formatter={(value) => [currency ? formatCurrency(Number(value)) : Number(value), ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
