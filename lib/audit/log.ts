import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/types";

export type AuditMetadata = {
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  path?: string | null;
  [key: string]: unknown;
};

type AuditParams = {
  organizationId: string;
  userId?: string | null;
  actorRole?: MemberRole | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: AuditMetadata;
};

/**
 * Write an audit log entry. Never throws — audit must not block primary ops.
 * Prefer passing actorRole / actorEmail; otherwise they are resolved from the session.
 */
export async function writeAuditLog(params: AuditParams) {
  try {
    const supabase = await createClient();

    let actorRole = params.actorRole ?? null;
    let actorEmail = params.actorEmail ?? null;
    let userId = params.userId ?? null;

    if (!userId || !actorEmail || !actorRole) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = userId ?? user?.id ?? null;
      actorEmail = actorEmail ?? user?.email ?? null;

      if (!actorRole && userId) {
        const { data: member } = await supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", params.organizationId)
          .eq("user_id", userId)
          .maybeSingle();
        actorRole = (member?.role as MemberRole | undefined) ?? null;
      }
    }

    await supabase.from("audit_logs").insert({
      organization_id: params.organizationId,
      user_id: userId,
      actor_role: actorRole,
      actor_email: actorEmail,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Audit failures must not block primary operations
  }
}
