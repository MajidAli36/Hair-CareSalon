import { requireMinimumRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  compareMetric,
  getPreviousPeriod,
  resolveReportRange,
  type CompareResult,
} from "@/lib/reports/range";

export type ReportContext = {
  organizationId: string;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
};

export async function createReportContext(from?: string, to?: string): Promise<ReportContext> {
  const org = await requireMinimumRole("MANAGER");
  const { start, end, fromLabel, toLabel } = resolveReportRange(from, to);
  const prev = getPreviousPeriod(fromLabel, toLabel);
  const prevRange = resolveReportRange(prev.from, prev.to);

  return {
    organizationId: org.organizationId,
    from: fromLabel,
    to: toLabel,
    prevFrom: prev.from,
    prevTo: prev.to,
    start,
    end,
    prevStart: prevRange.start,
    prevEnd: prevRange.end,
  };
}

export async function getSupabase() {
  return createClient();
}

export function cmp(current: number, previous: number): CompareResult {
  return compareMetric(current, previous);
}

export type CompletedSaleRow = {
  id: string;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  deposit_applied: number;
  completed_at: string | null;
  customer_id: string | null;
  appointment_id: string | null;
  staff_id: string | null;
  created_by: string | null;
  status: string;
};

export async function fetchCompletedSales(
  ctx: ReportContext,
  which: "current" | "previous" = "current"
): Promise<CompletedSaleRow[]> {
  const supabase = await getSupabase();
  const start = which === "current" ? ctx.start : ctx.prevStart;
  const end = which === "current" ? ctx.end : ctx.prevEnd;

  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, total, subtotal, discount, tax, deposit_applied, completed_at, customer_id, appointment_id, staff_id, created_by, status"
    )
    .eq("organization_id", ctx.organizationId)
    .in("status", ["COMPLETED", "AMENDED"])
    .gte("completed_at", start.toISOString())
    .lte("completed_at", end.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    total: Number(s.total) || 0,
    subtotal: Number(s.subtotal) || 0,
    discount: Number(s.discount) || 0,
    tax: Number(s.tax) || 0,
    deposit_applied: Number(s.deposit_applied) || 0,
    completed_at: s.completed_at,
    customer_id: s.customer_id,
    appointment_id: s.appointment_id,
    staff_id: s.staff_id,
    created_by: s.created_by,
    status: s.status,
  }));
}

export async function fetchSaleItems(
  organizationId: string,
  saleIds: string[]
): Promise<
  {
    sale_id: string;
    item_type: string;
    item_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[]
> {
  if (!saleIds.length) return [];
  const supabase = await getSupabase();
  // Chunk to avoid huge IN clauses
  const chunks: string[][] = [];
  for (let i = 0; i < saleIds.length; i += 200) {
    chunks.push(saleIds.slice(i, i + 200));
  }
  const rows: {
    sale_id: string;
    item_type: string;
    item_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[] = [];

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("sale_items")
      .select("sale_id, item_type, item_id, name, quantity, unit_price, line_total")
      .eq("organization_id", organizationId)
      .in("sale_id", chunk);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      rows.push({
        sale_id: r.sale_id,
        item_type: r.item_type,
        item_id: r.item_id,
        name: r.name,
        quantity: Number(r.quantity) || 0,
        unit_price: Number(r.unit_price) || 0,
        line_total: Number(r.line_total) || 0,
      });
    }
  }
  return rows;
}
