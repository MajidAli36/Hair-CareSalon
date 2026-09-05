import { formatCurrency } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { MemberRole } from "@/types";
import type { AuditLogRow } from "@/lib/actions/audit";

export type AuditTone = "neutral" | "success" | "warning" | "danger" | "info";

export type PresentedAudit = {
  actionLabel: string;
  actionCode: string;
  tone: AuditTone;
  entityLabel: string;
  entityHref: string | null;
  detail: string;
  detailLines: { label: string; value: string }[];
  actorLabel: string;
  roleLabel: string;
};

const ACTION_META: Record<
  string,
  { label: string; tone: AuditTone }
> = {
  "sale.complete": { label: "Sale completed", tone: "success" },
  "sale.amend": { label: "Sale amended", tone: "warning" },
  "sale.void": { label: "Sale voided", tone: "danger" },
  "sale.refund": { label: "Sale refunded", tone: "warning" },
  "payment.created": { label: "Payment recorded", tone: "success" },
  "payment.allocated": { label: "Payment allocated", tone: "info" },
  "deposit.refund": { label: "Advance refunded", tone: "warning" },
  "appointment.manual_payment": { label: "Manual appointment payment", tone: "info" },
  "appointment.cancel": { label: "Appointment cancelled", tone: "danger" },
  "customer.delete": { label: "Customer deleted", tone: "danger" },
  "staff.delete": { label: "Staff deleted", tone: "danger" },
  "service.delete": { label: "Service deleted", tone: "danger" },
  "service_category.delete": { label: "Service category deleted", tone: "danger" },
  "product.delete": { label: "Product deleted", tone: "danger" },
  "product_category.delete": { label: "Product category deleted", tone: "danger" },
  "package.delete": { label: "Package deleted", tone: "danger" },
  "chair.delete": { label: "Chair deleted", tone: "danger" },
  "staff_note.warning": { label: "Staff warning logged", tone: "warning" },
  "staff_note.complaint": { label: "Staff complaint logged", tone: "danger" },
  "staff_note.praise": { label: "Staff praise logged", tone: "success" },
  "staff_note.note": { label: "Staff note logged", tone: "info" },
  "feedback.created": { label: "Customer feedback recorded", tone: "success" },
};

const ENTITY_META: Record<string, { label: string; href?: (id: string) => string }> = {
  sale: { label: "Sale", href: (id) => `/sales/${id}` },
  customer: { label: "Customer", href: (id) => `/customers/${id}` },
  staff: { label: "Staff", href: (id) => `/staff/${id}` },
  appointment: { label: "Appointment", href: () => `/appointments` },
  appointment_deposit: { label: "Advance deposit", href: () => `/appointments` },
  service: { label: "Service", href: () => `/services` },
  service_category: { label: "Service category", href: () => `/services` },
  product: { label: "Product", href: () => `/products` },
  product_category: { label: "Product category", href: () => `/products` },
  package: { label: "Package", href: () => `/services` },
  chair: { label: "Chair", href: () => `/chairs` },
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function money(v: unknown): string | null {
  const n = asNumber(v);
  return n == null ? null : formatCurrency(n);
}

function titleCaseAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function entityDisplayName(
  log: AuditLogRow,
  entityLabels?: Map<string, string>
): string {
  if (log.entity_label?.trim()) return log.entity_label.trim();

  const key = `${log.entity_type}:${log.entity_id ?? ""}`;
  const enriched = entityLabels?.get(key);
  if (enriched) return enriched;

  const meta = ENTITY_META[log.entity_type];
  const base = meta?.label ?? titleCaseAction(log.entity_type);
  if (!log.entity_id) return base;
  return `${base} ${log.entity_id.slice(0, 8)}`;
}

function buildDetailLines(log: AuditLogRow): { label: string; value: string }[] {
  const m = log.metadata ?? {};
  const lines: { label: string; value: string }[] = [];

  const summary = asString(m.summary);
  if (summary) lines.push({ label: "Summary", value: summary });

  const reason = asString(m.reason);
  if (reason) lines.push({ label: "Reason", value: reason });

  switch (log.action) {
    case "sale.complete": {
      const total = money(m.total);
      const items = asNumber(m.itemCount);
      const collected = money(m.collectedNow);
      const due = money(m.remainingDue ?? m.amountDue);
      const change = money(m.changeGiven);
      const status = asString(m.paymentStatus);
      if (total) lines.push({ label: "Total", value: total });
      if (items != null) lines.push({ label: "Items", value: String(items) });
      if (collected) lines.push({ label: "Collected", value: collected });
      if (due && asNumber(m.remainingDue ?? m.amountDue) !== 0) {
        lines.push({ label: "Still due", value: due });
      }
      if (change && asNumber(m.changeGiven) !== 0) {
        lines.push({ label: "Change", value: change });
      }
      if (status) lines.push({ label: "Payment status", value: status.replace(/_/g, " ") });
      break;
    }
    case "sale.amend": {
      const from = asNumber(m.fromVersion);
      const to = asNumber(m.toVersion);
      const oldTotal = money(m.oldTotal);
      const newTotal = money(m.newTotal);
      if (from != null && to != null) {
        lines.push({ label: "Version", value: `v${from} → v${to}` });
      }
      if (oldTotal && newTotal) {
        lines.push({ label: "Total", value: `${oldTotal} → ${newTotal}` });
      }
      break;
    }
    case "sale.void": {
      const before =
        m.before && typeof m.before === "object"
          ? (m.before as Record<string, unknown>)
          : null;
      const total = money(m.total ?? before?.total);
      if (total) lines.push({ label: "Voided total", value: total });
      break;
    }
    case "sale.refund": {
      const amount = money(m.amount);
      const method = asString(m.method);
      if (amount) lines.push({ label: "Refund amount", value: amount });
      if (method) lines.push({ label: "Method", value: method });
      if (m.fullyRefunded === true) lines.push({ label: "Status", value: "Fully refunded" });
      break;
    }
    case "payment.created":
    case "payment.allocated": {
      const amount = money(m.amount);
      const method = asString(m.method);
      const due = money(m.amountDue);
      if (amount) lines.push({ label: "Amount", value: amount });
      if (method) lines.push({ label: "Method", value: method });
      if (due) lines.push({ label: "Remaining due", value: due });
      break;
    }
    case "deposit.refund":
    case "appointment.manual_payment": {
      const amount = money(m.amount);
      const method = asString(m.method ?? m.refundMethod);
      if (amount) lines.push({ label: "Amount", value: amount });
      if (method) lines.push({ label: "Method", value: method });
      break;
    }
    default: {
      if (asString(m.deleted_by_role)) {
        lines.push({ label: "Deleted by role", value: String(m.deleted_by_role) });
      }
      break;
    }
  }

  // Deduplicate by label keeping first
  const seen = new Set<string>();
  return lines.filter((l) => {
    if (seen.has(l.label)) return false;
    seen.add(l.label);
    return true;
  });
}

function buildDetailSentence(log: AuditLogRow, lines: { label: string; value: string }[]): string {
  const m = log.metadata ?? {};
  const summary = asString(m.summary);
  if (summary) return summary;

  const reason = asString(m.reason);
  switch (log.action) {
    case "sale.complete": {
      const total = money(m.total);
      const items = asNumber(m.itemCount);
      const parts = [
        total ? `Total ${total}` : null,
        items != null ? `${items} item${items === 1 ? "" : "s"}` : null,
        asNumber(m.remainingDue) ? `Due ${money(m.remainingDue)}` : null,
      ].filter(Boolean);
      return parts.join(" · ") || "Checkout completed";
    }
    case "sale.amend": {
      const oldTotal = money(m.oldTotal);
      const newTotal = money(m.newTotal);
      const base =
        oldTotal && newTotal ? `Total ${oldTotal} → ${newTotal}` : "Sale details updated";
      return reason ? `${base} · ${reason}` : base;
    }
    case "sale.void":
      return reason ? `Voided · ${reason}` : "Sale voided";
    case "sale.refund": {
      const amount = money(m.amount);
      return [amount ? `Refunded ${amount}` : "Refund issued", reason].filter(Boolean).join(" · ");
    }
    case "payment.created":
    case "payment.allocated": {
      const amount = money(m.amount);
      const method = asString(m.method);
      return [amount ? `Received ${amount}` : "Payment recorded", method].filter(Boolean).join(" · ");
    }
    case "deposit.refund": {
      const amount = money(m.amount);
      return [amount ? `Refunded ${amount}` : "Advance refunded", reason].filter(Boolean).join(" · ");
    }
    case "appointment.cancel":
      return reason ? `Cancelled · ${reason}` : "Appointment cancelled";
    case "appointment.manual_payment": {
      const amount = money(m.amount);
      const method = asString(m.method);
      return [amount ? `Recorded ${amount}` : "Manual payment", method].filter(Boolean).join(" · ");
    }
    default:
      break;
  }

  if (reason) return reason;
  if (lines.length) {
    return lines
      .filter((l) => l.label !== "Summary")
      .slice(0, 2)
      .map((l) => l.value)
      .join(" · ");
  }
  return "No extra detail recorded";
}

export function formatRoleLabel(role: MemberRole | string | null | undefined): string {
  if (!role) return "Unknown role";
  if (role in ROLE_LABELS) return ROLE_LABELS[role as MemberRole];
  return titleCaseAction(String(role));
}

export function presentAuditLog(
  log: AuditLogRow,
  options?: { entityLabels?: Map<string, string> }
): PresentedAudit {
  const meta = ACTION_META[log.action] ?? {
    label: titleCaseAction(log.action),
    tone: "neutral" as AuditTone,
  };
  const entityMeta = ENTITY_META[log.entity_type];
  const entityName = entityDisplayName(log, options?.entityLabels);
  const detailLines = buildDetailLines(log);
  const detail = buildDetailSentence(log, detailLines);

  const actorLabel =
    log.actor_email?.trim() ||
    (log.user_id ? `User ${log.user_id.slice(0, 8)}` : "System / unknown");

  return {
    actionLabel: meta.label,
    actionCode: log.action,
    tone: meta.tone,
    entityLabel: entityName,
    entityHref:
      log.entity_id && entityMeta?.href ? entityMeta.href(log.entity_id) : null,
    detail,
    detailLines,
    actorLabel,
    roleLabel: formatRoleLabel(log.actor_role),
  };
}

export function toneBadgeVariant(
  tone: AuditTone
): "default" | "secondary" | "outline" | "destructive" {
  switch (tone) {
    case "danger":
      return "destructive";
    case "success":
      return "default";
    case "warning":
    case "info":
      return "outline";
    default:
      return "secondary";
  }
}
