import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/organization";
import type { MemberRole } from "@/types";
import { writeAuditLog } from "@/lib/audit/log";

type SoftDeleteTable =
  | "customers"
  | "staff"
  | "services"
  | "service_categories"
  | "products"
  | "product_categories"
  | "packages"
  | "sales"
  | "invoices"
  | "appointments"
  | "chairs";

export type SoftDeleteActor = {
  userId: string;
  email: string | null;
  role: MemberRole;
  organizationId: string;
};

export async function resolveSoftDeleteActor(): Promise<SoftDeleteActor> {
  const org = await requireOrganization();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: org.role,
    organizationId: org.organizationId,
  };
}

export function softDeletePatch(actor: SoftDeleteActor) {
  const now = new Date().toISOString();
  return {
    deleted_at: now,
    deleted_by: actor.userId,
    deleted_by_role: actor.role,
    updated_by: actor.userId,
  };
}

type SoftDeleteOptions = {
  table: SoftDeleteTable;
  id: string;
  organizationId: string;
  actor: SoftDeleteActor;
  action: string;
  entityType: string;
  summary: string;
  before?: Record<string, unknown> | null;
  reason?: string | null;
  extraPatch?: Record<string, unknown>;
};

/**
 * Soft-delete a core org-scoped row and write a detailed audit log.
 */
export async function softDeleteEntity(options: SoftDeleteOptions): Promise<{ error?: string }> {
  const supabase = await createClient();
  const patch = {
    ...softDeletePatch(options.actor),
    ...(options.extraPatch ?? {}),
  };

  const { error } = await supabase
    .from(options.table)
    .update(patch)
    .eq("id", options.id)
    .eq("organization_id", options.organizationId)
    .is("deleted_at", null);

  if (error) return { error: error.message };

  await writeAuditLog({
    organizationId: options.organizationId,
    userId: options.actor.userId,
    actorRole: options.actor.role,
    actorEmail: options.actor.email,
    action: options.action,
    entityType: options.entityType,
    entityId: options.id,
    metadata: {
      summary: options.summary,
      before: options.before ?? null,
      reason: options.reason ?? null,
      deleted_at: patch.deleted_at,
      deleted_by_role: options.actor.role,
    },
  });

  return {};
}
