import { createClient } from "@/lib/supabase/server";

type AuditParams = {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(params: AuditParams) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      organization_id: params.organizationId,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Audit failures must not block primary operations
  }
}
