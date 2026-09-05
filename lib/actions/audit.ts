"use server";

import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import type { MemberRole } from "@/types";

export type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
  actor_role: MemberRole | null;
  actor_email: string | null;
  /** Resolved display label for the entity (invoice no., name, etc.) */
  entity_label?: string | null;
};

export async function getAuditLogs(limit = 200): Promise<AuditLogRow[]> {
  await requireMinimumRole("MANAGER");
  const org = await requireOrganization();
  const supabase = await createClient();
  const orgId = org.organizationId;

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AuditLogRow[];

  // Backfill missing actor email/role from current org membership
  const needUserIds = [
    ...new Set(
      rows
        .filter((r) => r.user_id && (!r.actor_email || !r.actor_role))
        .map((r) => r.user_id as string)
    ),
  ];

  const memberByUser = new Map<
    string,
    { email: string | null; role: MemberRole | null }
  >();

  if (needUserIds.length) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", orgId)
      .in("user_id", needUserIds);

    for (const m of members ?? []) {
      memberByUser.set(m.user_id, {
        email: null,
        role: m.role as MemberRole,
      });
    }

    // Prefer emails already stored on other audit rows
    const { data: prior } = await supabase
      .from("audit_logs")
      .select("user_id, actor_email, actor_role")
      .eq("organization_id", orgId)
      .in("user_id", needUserIds)
      .not("actor_email", "is", null)
      .limit(500);

    for (const a of prior ?? []) {
      if (!a.user_id) continue;
      const cur = memberByUser.get(a.user_id) ?? { email: null, role: null };
      if (!cur.email && a.actor_email) cur.email = a.actor_email;
      if (!cur.role && a.actor_role) cur.role = a.actor_role as MemberRole;
      memberByUser.set(a.user_id, cur);
    }

    // Resolve remaining emails via admin auth API when available
    const stillNeedEmail = needUserIds.filter((id) => !memberByUser.get(id)?.email);
    if (stillNeedEmail.length) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        await Promise.all(
          stillNeedEmail.map(async (userId) => {
            try {
              const { data: u } = await admin.auth.admin.getUserById(userId);
              const email = u.user?.email ?? null;
              if (!email) return;
              const cur = memberByUser.get(userId) ?? { email: null, role: null };
              cur.email = email;
              memberByUser.set(userId, cur);
            } catch {
              // ignore per-user lookup failures
            }
          })
        );
      } catch {
        // Admin client not configured — leave emails blank
      }
    }
  }

  // Resolve friendly labels for sale / customer / staff entities in this page
  const saleIds = [
    ...new Set(
      rows
        .filter((r) => r.entity_type === "sale" && r.entity_id)
        .map((r) => r.entity_id as string)
    ),
  ];
  const customerIds = [
    ...new Set(
      rows
        .filter((r) => r.entity_type === "customer" && r.entity_id)
        .map((r) => r.entity_id as string)
    ),
  ];
  const staffIds = [
    ...new Set(
      rows
        .filter((r) => r.entity_type === "staff" && r.entity_id)
        .map((r) => r.entity_id as string)
    ),
  ];

  const entityLabels = new Map<string, string>();

  if (saleIds.length) {
    for (let i = 0; i < saleIds.length; i += 100) {
      const chunk = saleIds.slice(i, i + 100);
      const { data: sales } = await supabase
        .from("sales")
        .select("id, total, status, invoice:invoices(invoice_number)")
        .eq("organization_id", orgId)
        .in("id", chunk);
      for (const s of sales ?? []) {
        const inv = Array.isArray(s.invoice) ? s.invoice[0] : s.invoice;
        const invNo =
          inv && typeof inv === "object" && "invoice_number" in inv
            ? String((inv as { invoice_number: string }).invoice_number)
            : s.id.slice(0, 8);
        entityLabels.set(
          `sale:${s.id}`,
          `${invNo} · ${formatCurrency(Number(s.total))}`
        );
      }
    }
  }

  if (customerIds.length) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("organization_id", orgId)
      .in("id", customerIds);
    for (const c of customers ?? []) {
      entityLabels.set(
        `customer:${c.id}`,
        [c.first_name, c.last_name].filter(Boolean).join(" ")
      );
    }
  }

  if (staffIds.length) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .in("id", staffIds);
    for (const s of staff ?? []) {
      entityLabels.set(`staff:${s.id}`, s.full_name);
    }
  }

  return rows.map((row) => {
    const member = row.user_id ? memberByUser.get(row.user_id) : undefined;
    const key = row.entity_id ? `${row.entity_type}:${row.entity_id}` : null;
    return {
      ...row,
      actor_email: row.actor_email ?? member?.email ?? null,
      actor_role: row.actor_role ?? member?.role ?? null,
      entity_label: key ? entityLabels.get(key) ?? null : null,
    };
  });
}

export type DeletedRecordRow = {
  id: string;
  entityType: string;
  label: string;
  deleted_at: string;
  deleted_by_role: MemberRole | null;
  deleted_by_email: string | null;
};

async function mapDeleted(
  entityType: string,
  rows: Array<{
    id: string;
    deleted_at: string | null;
    deleted_by: string | null;
    deleted_by_role: MemberRole | null;
    label: string;
  }>,
  emailByUserId: Map<string, string>
): Promise<DeletedRecordRow[]> {
  return rows
    .filter((r) => r.deleted_at)
    .map((r) => ({
      id: r.id,
      entityType,
      label: r.label,
      deleted_at: r.deleted_at!,
      deleted_by_role: r.deleted_by_role,
      deleted_by_email: r.deleted_by ? emailByUserId.get(r.deleted_by) ?? null : null,
    }));
}

export async function getDeletedRecords(): Promise<DeletedRecordRow[]> {
  await requireMinimumRole("MANAGER");
  const org = await requireOrganization();
  const supabase = await createClient();
  const orgId = org.organizationId;

  const [
    customers,
    staff,
    services,
    products,
    packages,
    sales,
    appointments,
    chairs,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("staff")
      .select("id, full_name, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("services")
      .select("id, name, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("products")
      .select("id, name, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("packages")
      .select("id, name, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("sales")
      .select("id, total, status, deleted_at, deleted_by, deleted_by_role, invoice:invoices(invoice_number)")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
    supabase
      .from("chairs")
      .select("id, name, deleted_at, deleted_by, deleted_by_role")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
  ]);

  const userIds = new Set<string>();
  for (const bundle of [
    customers.data,
    staff.data,
    services.data,
    products.data,
    packages.data,
    sales.data,
    appointments.data,
    chairs.data,
  ]) {
    for (const row of bundle ?? []) {
      if (row.deleted_by) userIds.add(row.deleted_by);
    }
  }

  const emailByUserId = new Map<string, string>();
  // Prefer emails already captured on audit_logs for these users
  if (userIds.size > 0) {
    const { data: audits } = await supabase
      .from("audit_logs")
      .select("user_id, actor_email")
      .eq("organization_id", orgId)
      .in("user_id", [...userIds])
      .not("actor_email", "is", null)
      .limit(200);
    for (const a of audits ?? []) {
      if (a.user_id && a.actor_email && !emailByUserId.has(a.user_id)) {
        emailByUserId.set(a.user_id, a.actor_email);
      }
    }
  }

  const salesLabels = (sales.data ?? []).map((s) => {
    const inv = Array.isArray(s.invoice) ? s.invoice[0] : s.invoice;
    const invNo = inv && typeof inv === "object" && "invoice_number" in inv
      ? String((inv as { invoice_number: string }).invoice_number)
      : s.id.slice(0, 8);
    return {
      id: s.id,
      deleted_at: s.deleted_at,
      deleted_by: s.deleted_by,
      deleted_by_role: s.deleted_by_role as MemberRole | null,
      label: `${invNo} · ${s.status} · Rs ${Number(s.total).toLocaleString("en-PK")}`,
    };
  });

  const merged = [
    ...(await mapDeleted(
      "customer",
      (customers.data ?? []).map((c) => ({
        id: c.id,
        deleted_at: c.deleted_at,
        deleted_by: c.deleted_by,
        deleted_by_role: c.deleted_by_role as MemberRole | null,
        label: [c.first_name, c.last_name].filter(Boolean).join(" "),
      })),
      emailByUserId
    )),
    ...(await mapDeleted(
      "staff",
      (staff.data ?? []).map((s) => ({
        id: s.id,
        deleted_at: s.deleted_at,
        deleted_by: s.deleted_by,
        deleted_by_role: s.deleted_by_role as MemberRole | null,
        label: s.full_name,
      })),
      emailByUserId
    )),
    ...(await mapDeleted(
      "service",
      (services.data ?? []).map((s) => ({
        id: s.id,
        deleted_at: s.deleted_at,
        deleted_by: s.deleted_by,
        deleted_by_role: s.deleted_by_role as MemberRole | null,
        label: s.name,
      })),
      emailByUserId
    )),
    ...(await mapDeleted(
      "product",
      (products.data ?? []).map((p) => ({
        id: p.id,
        deleted_at: p.deleted_at,
        deleted_by: p.deleted_by,
        deleted_by_role: p.deleted_by_role as MemberRole | null,
        label: p.name,
      })),
      emailByUserId
    )),
    ...(await mapDeleted(
      "package",
      (packages.data ?? []).map((p) => ({
        id: p.id,
        deleted_at: p.deleted_at,
        deleted_by: p.deleted_by,
        deleted_by_role: p.deleted_by_role as MemberRole | null,
        label: p.name,
      })),
      emailByUserId
    )),
    ...(await mapDeleted("sale", salesLabels, emailByUserId)),
    ...(await mapDeleted(
      "appointment",
      (appointments.data ?? []).map((a) => ({
        id: a.id,
        deleted_at: a.deleted_at,
        deleted_by: a.deleted_by,
        deleted_by_role: a.deleted_by_role as MemberRole | null,
        label: `${a.status} · ${a.scheduled_at}`,
      })),
      emailByUserId
    )),
    ...(await mapDeleted(
      "chair",
      (chairs.data ?? []).map((c) => ({
        id: c.id,
        deleted_at: c.deleted_at,
        deleted_by: c.deleted_by,
        deleted_by_role: c.deleted_by_role as MemberRole | null,
        label: c.name,
      })),
      emailByUserId
    )),
  ];

  return merged.sort(
    (a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
  );
}
